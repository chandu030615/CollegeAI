const chatService = require('../services/chatService');
const ragService = require('../services/ragService');
const { sendSuccess } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');
const { supabase, localDb, isSupabaseConfigured } = require('../config/database');

const streamMessage = async (req, res, next) => {
  try {
    const { conversationId, message, categoryFilter } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message text is required.' } });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let activeConversationId = conversationId || uuidv4();
    let conversationTitle = message.trim().substring(0, 40) + (message.trim().length > 40 ? '...' : '');

    // Ensure conversation exists
    if (!conversationId) {
      const newConv = {
        id: activeConversationId,
        user_id: userId,
        title: conversationTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (isSupabaseConfigured()) {
        await supabase.from('conversations').insert(newConv);
      } else {
        localDb.conversations.push(newConv);
      }
    }

    // Save User Message
    const userMsgRecord = {
      id: uuidv4(),
      conversation_id: activeConversationId,
      role: 'user',
      content: message.trim(),
      sources: [],
      relevance_score: 0.0,
      created_at: new Date().toISOString()
    };
    if (isSupabaseConfigured()) {
      await supabase.from('messages').insert(userMsgRecord);
    } else {
      localDb.messages.push(userMsgRecord);
    }

    // Process RAG with streaming callback
    let fullAnswerText = '';

    const ragResult = await ragService.processQuestion(
      message.trim(),
      (tokenText) => {
        fullAnswerText += tokenText;
        res.write(`data: ${JSON.stringify({ type: 'token', content: tokenText })}\n\n`);
      },
      categoryFilter
    );

    const { sources, relevanceScore } = ragResult;

    // Send Sources metadata event
    res.write(`data: ${JSON.stringify({ type: 'sources', sources, conversationId: activeConversationId, relevanceScore })}\n\n`);

    // Save Assistant Message
    const assistantMsgRecord = {
      id: uuidv4(),
      conversation_id: activeConversationId,
      role: 'assistant',
      content: fullAnswerText || ragResult.answer,
      sources,
      relevance_score: relevanceScore,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      await supabase.from('messages').insert(assistantMsgRecord);
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversationId);
    } else {
      localDb.messages.push(assistantMsgRecord);
      const conv = localDb.conversations.find(c => c.id === activeConversationId);
      if (conv) conv.updated_at = new Date().toISOString();
    }

    // End SSE stream
    res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMsgRecord, conversationId: activeConversationId })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[Stream Error]:', err);
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const result = await chatService.sendMessage({
      userId: req.user.id,
      conversationId: req.body.conversationId,
      message: req.body.message
    });
    return sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const conversations = await chatService.getUserConversations(req.user.id);
    return sendSuccess(res, { conversations }, 200);
  } catch (err) {
    next(err);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const conversation = await chatService.getConversationById(req.params.id, req.user.id);
    return sendSuccess(res, { conversation }, 200);
  } catch (err) {
    next(err);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    const result = await chatService.deleteConversation(req.params.id, req.user.id);
    return sendSuccess(res, { message: 'Conversation deleted successfully', conversationId: result.id }, 200);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendMessage,
  streamMessage,
  getHistory,
  getConversation,
  deleteConversation
};
