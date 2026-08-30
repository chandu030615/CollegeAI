const { v4: uuidv4 } = require('uuid');
const { supabase, localDb, isSupabaseConfigured } = require('../config/database');
const ragService = require('./ragService');

/**
 * Handles sending a student question in a conversation and receiving a grounded AI response
 */
const sendMessage = async ({ userId, conversationId, message }) => {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Message text is required.' };
  }

  let activeConversationId = conversationId;
  let conversationTitle = message.trim().substring(0, 40) + (message.trim().length > 40 ? '...' : '');

  // 1. Ensure Conversation Exists or Create New Conversation
  if (!activeConversationId) {
    activeConversationId = uuidv4();
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

  // 2. Save User Message to Database
  const userMsgId = uuidv4();
  const userMsgRecord = {
    id: userMsgId,
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

  // 3. Process RAG Pipeline
  const ragResult = await ragService.processQuestion(message.trim());
  const { answer, sources, relevanceScore } = ragResult;

  // 4. Save Assistant Grounded Response to Database
  const assistantMsgId = uuidv4();
  const assistantMsgRecord = {
    id: assistantMsgId,
    conversation_id: activeConversationId,
    role: 'assistant',
    content: answer,
    sources,
    relevance_score: relevanceScore,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    await supabase.from('messages').insert(assistantMsgRecord);
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeConversationId);
  } else {
    localDb.messages.push(assistantMsgRecord);
    const conv = localDb.conversations.find(c => c.id === activeConversationId);
    if (conv) conv.updated_at = new Date().toISOString();
  }

  return {
    conversationId: activeConversationId,
    message: assistantMsgRecord
  };
};

/**
 * Gets conversation history for user
 */
const getUserConversations = async (userId) => {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    return data || [];
  } else {
    return localDb.conversations
      .filter(c => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
};

/**
 * Gets details of a conversation including all messages
 */
const getConversationById = async (conversationId, userId) => {
  let conv;
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    conv = data;
  } else {
    conv = localDb.conversations.find(c => c.id === conversationId);
  }

  if (!conv || conv.user_id !== userId) {
    throw { statusCode: 404, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' };
  }

  let messages = [];
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    messages = data || [];
  } else {
    messages = localDb.messages
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  return {
    ...conv,
    messages
  };
};

/**
 * Deletes a conversation and its messages
 */
const deleteConversation = async (conversationId, userId) => {
  await getConversationById(conversationId, userId); // verify ownership

  if (isSupabaseConfigured()) {
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);
  } else {
    localDb.messages = localDb.messages.filter(m => m.conversation_id !== conversationId);
    localDb.conversations = localDb.conversations.filter(c => c.id !== conversationId);
  }

  return { id: conversationId };
};

module.exports = {
  sendMessage,
  getUserConversations,
  getConversationById,
  deleteConversation
};
