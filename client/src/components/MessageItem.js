import React, { useState } from 'react';
import SourceCard from './SourceCard';
import { Bot, User, ThumbsUp, ThumbsDown, Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';

export default function MessageItem({ message }) {
  const isUser = message.role === 'user';
  const [feedback, setFeedback] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`py-6 px-4 md:px-6 transition-colors ${
      isUser ? 'bg-gray-900/40' : 'bg-gray-900/90 border-y border-gray-800/60'
    }`}>
      <div className="max-w-4xl mx-auto flex space-x-4">
        {/* Avatar */}
        <div className="shrink-0">
          {isUser ? (
            <div className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300">
              <User className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Message Content Body */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-gray-200">
                {isUser ? 'You' : 'CollegeAI Assistant'}
              </span>
              {!isUser && (
                <span className="flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  <span>Grounded Answer</span>
                </span>
              )}
            </div>

            <span className="text-xs text-gray-500">
              {new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Formatted Text Content */}
          <div className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
            {message.content}
          </div>

          {/* Source Documents Grid if Assistant */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sources Used ({message.sources.length}):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.sources.map((source, index) => (
                  <SourceCard key={index} source={source} />
                ))}
              </div>
            </div>
          )}

          {/* Action Bar (Copy & Feedback) */}
          {!isUser && (
            <div className="flex items-center space-x-4 pt-2 text-xs text-gray-400">
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 hover:text-gray-200 transition-colors"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <div className="h-3 w-[1px] bg-gray-800" />

              <div className="flex items-center space-x-2">
                <span>Was this answer helpful?</span>
                <button
                  onClick={() => setFeedback('up')}
                  className={`p-1 rounded hover:bg-gray-800 transition-colors ${
                    feedback === 'up' ? 'text-emerald-400' : 'hover:text-emerald-400'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFeedback('down')}
                  className={`p-1 rounded hover:bg-gray-800 transition-colors ${
                    feedback === 'down' ? 'text-rose-400' : 'hover:text-rose-400'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
