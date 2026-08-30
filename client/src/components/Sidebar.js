import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MessageSquarePlus, MessageSquare, Trash2, Search, Sparkles } from 'lucide-react';

export default function Sidebar({ conversations = [], activeId, onNewChat, onDeleteChat }) {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const filtered = conversations.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-full md:w-80 bg-gray-900/90 border-r border-gray-800 flex flex-col h-[calc(100vh-4rem)]">
      {/* Action Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col space-y-3">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
        >
          <MessageSquarePlus className="w-5 h-5" />
          <span>New Conversation</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-500/40" />
            <p>No conversations found</p>
            <p className="text-xs text-gray-600 mt-1">Start a new chat to ask college questions.</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <div
                key={conv.id}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
                onClick={() => router.push(`/chat/${conv.id}`)}
              >
                <div className="flex items-center space-x-3 truncate pr-6">
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(conv.updated_at || conv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
