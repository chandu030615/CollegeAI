import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Tag, Percent } from 'lucide-react';

export default function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);

  const percentage = Math.min(Math.round((source.relevanceScore || 0) * 100), 100);

  return (
    <div className="rounded-xl bg-gray-800/60 border border-gray-700/60 p-3 text-xs transition-all hover:border-indigo-500/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 truncate">
          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-gray-200 truncate" title={source.documentTitle}>
            {source.documentTitle}
          </span>
          {source.pageNumber && (
            <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px]">
              Page {source.pageNumber}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
            percentage >= 70
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            {percentage}% Relevance
          </span>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white p-0.5"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-700/50 space-y-1.5 text-gray-300">
          <div className="flex items-center space-x-2 text-[11px] text-gray-400">
            <Tag className="w-3 h-3 text-indigo-400" />
            <span>Category: <strong className="text-gray-300">{source.category || 'General'}</strong></span>
          </div>
          {source.snippet && (
            <div className="bg-gray-900/80 p-2 rounded-lg text-gray-300 font-mono text-[11px] leading-relaxed border border-gray-800">
              "{source.snippet}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
