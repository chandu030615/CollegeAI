import React from 'react';
import { X, Layers, FileText, Database } from 'lucide-react';

export default function ChunkInspectorModal({ document, onClose }) {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col border border-gray-700 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-100">{document.title}</h3>
              <p className="text-xs text-gray-400">
                {document.category} • {document.chunks?.length || 0} Vector Chunks Extracted
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-950/60">
          {(!document.chunks || document.chunks.length === 0) ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <Database className="w-10 h-10 mx-auto mb-2 text-gray-600" />
              <p>No chunk vectors indexed yet for this document.</p>
            </div>
          ) : (
            document.chunks.map((chunk, idx) => (
              <div
                key={chunk.id || idx}
                className="bg-gray-900/90 border border-gray-800 rounded-xl p-4 space-y-2 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-800">
                  <span className="font-semibold text-indigo-400">
                    Chunk #{chunk.chunk_index + 1}
                  </span>
                  <div className="flex items-center space-x-3">
                    <span>Page: <strong className="text-gray-300">{chunk.page_number}</strong></span>
                    <span>Length: <strong className="text-gray-300">{chunk.content?.length || 0} chars</strong></span>
                  </div>
                </div>

                <p className="text-sm text-gray-200 font-mono leading-relaxed bg-black/40 p-3 rounded-lg border border-gray-800/60 whitespace-pre-wrap">
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
