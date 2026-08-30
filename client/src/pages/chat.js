import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authContext';
import { chatApi } from '../services/api';
import Sidebar from '../components/Sidebar';
import MessageItem from '../components/MessageItem';
import { Send, Sparkles, Loader2, AlertCircle, Bot, HelpCircle, Download, Tag, Filter } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "What is the fee payment deadline for this semester?",
  "What are the hostel check-in and curfew guidelines?",
  "How can I apply for merit-based scholarships?",
  "What is the passing criteria for end semester examinations?"
];

const CATEGORIES = [
  'All', 'Admissions', 'Departments', 'Courses', 'Fees',
  'Examinations', 'Hostel', 'Library', 'Placements', 'Scholarships'
];

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: conversationId } = router.query;

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (conversationId && user) {
      fetchConversationDetails(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await chatApi.getHistory();
      if (res.success && res.data?.conversations) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.warn('Failed to load chat history:', err);
    }
  };

  const fetchConversationDetails = async (id) => {
    try {
      const res = await chatApi.getConversation(id);
      if (res.success && res.data?.conversation) {
        setMessages(res.data.conversation.messages || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load conversation.');
    }
  };

  const handleSend = async (textToSend) => {
    const query = textToSend || inputMessage;
    if (!query || !query.trim() || loading) return;

    setError('');
    setInputMessage('');

    // Optimistic User Message
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: query.trim(),
      created_at: new Date().toISOString()
    };

    const tempBotId = 'bot-' + Date.now();
    const tempBotMsg = {
      id: tempBotId,
      role: 'assistant',
      content: '',
      sources: [],
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg, tempBotMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem('collegeai_token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: query.trim(),
          conversationId,
          categoryFilter: selectedCategory === 'All' ? null : selectedCategory
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamContent = '';
      let streamSources = [];
      let activeConvId = conversationId;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'token') {
                streamContent += data.content;
                setMessages(prev => prev.map(m => m.id === tempBotId ? { ...m, content: streamContent } : m));
              } else if (data.type === 'sources') {
                streamSources = data.sources || [];
                activeConvId = data.conversationId;
                setMessages(prev => prev.map(m => m.id === tempBotId ? { ...m, sources: streamSources } : m));
              } else if (data.type === 'done') {
                await fetchConversations();
                if (!conversationId || conversationId !== activeConvId) {
                  router.push(`/chat/${activeConvId}`, undefined, { shallow: true });
                }
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err) {
      console.warn('Streaming failed, falling back to standard API:', err.message);
      try {
        const res = await chatApi.sendMessage(query.trim(), conversationId);
        if (res.success && res.data) {
          const { conversationId: newConvId, message: botMsg } = res.data;
          setMessages(prev => prev.map(m => m.id === tempBotId ? botMsg : m));
          await fetchConversations();
          if (!conversationId || conversationId !== newConvId) {
            router.push(`/chat/${newConvId}`, undefined, { shallow: true });
          }
        }
      } catch (fallbackErr) {
        setError(fallbackErr.message || 'Failed to get answer from CollegeAI.');
        setMessages(prev => prev.filter(m => m.id !== tempBotId));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (messages.length === 0) return;

    let markdown = `# CollegeAI Conversation Export\n`;
    markdown += `**Exported On**: ${new Date().toLocaleString()}\n`;
    markdown += `**Category Scope**: ${selectedCategory}\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.role === 'user' ? 'Student' : 'CollegeAI Assistant';
      markdown += `### ${sender} (${new Date(m.created_at || Date.now()).toLocaleTimeString()})\n\n${m.content}\n\n`;
      if (m.sources && m.sources.length > 0) {
        markdown += `**Sources Used:**\n`;
        m.sources.forEach(s => {
          markdown += `- ${s.documentTitle} (Page ${s.pageNumber || 1}, ${Math.round((s.relevanceScore || 0)*100)}% match)\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collegeai-chat-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNewChat = () => {
    setMessages([]);
    setError('');
    router.push('/chat');
  };

  const handleDeleteChat = async (idToDelete) => {
    try {
      await chatApi.deleteConversation(idToDelete);
      setConversations(prev => prev.filter(c => c.id !== idToDelete));
      if (conversationId === idToDelete) {
        handleNewChat();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete conversation');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden">
      
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full bg-gray-950/40 relative">
        
        {/* Top Scope & Action Toolbar */}
        <div className="p-3 border-b border-gray-800/80 bg-gray-900/80 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center space-x-2 shrink-0">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-gray-300">Department Scope:</span>
            <div className="flex items-center space-x-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 flex items-center space-x-1.5 shrink-0 transition-all"
              title="Export conversation as Markdown"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export Chat</span>
            </button>
          )}
        </div>

        {/* Chat Messages Window */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-8 animate-fade-in">
              
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/30">
                <Bot className="w-9 h-9 text-white" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-white">How can I help you today?</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Ask any question regarding college notices, fees, academics, hostels, placement, or policies.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" />
                  <span>Suggested Questions</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(q)}
                      className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-indigo-500/40 hover:bg-gray-900 transition-all text-xs text-gray-300 hover:text-white flex items-start space-x-2 group"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="pb-8">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}

              {loading && messages.length > 0 && messages[messages.length - 1].content === '' && (
                <div className="py-6 px-4 md:px-6 bg-gray-900/90 border-y border-gray-800/60">
                  <div className="max-w-4xl mx-auto flex space-x-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                      <Bot className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="flex items-center space-x-3 text-indigo-400 text-sm font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching vector store & streaming grounded answer...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock */}
        <div className="p-4 border-t border-gray-800/80 bg-gray-900/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto space-y-2">
            
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                placeholder={`Ask about ${selectedCategory === 'All' ? 'college policies, dates, fees, courses' : selectedCategory.toLowerCase() + ' details'}...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                className="w-full pl-4 pr-14 py-3.5 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="absolute right-2 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-all transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[11px] text-gray-500 text-center">
              CollegeAI RAG answers are generated strictly using uploaded official college documents.
            </p>

          </div>
        </div>

      </div>

    </div>
  );
}
