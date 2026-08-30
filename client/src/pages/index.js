import React from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowRight, Database, Search, Cpu, FileText, CheckCircle2, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-between">
      
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded Retrieval-Augmented Generation</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Instant Answers from Official <br className="hidden sm:inline" />
            <span className="text-gradient">College Knowledge Base</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 font-normal max-w-2xl mx-auto leading-relaxed">
            CollegeAI searches through administrator-uploaded PDFs, circulars, department FAQs, examination rules, hostel guidelines, and course catalogs to give accurate, grounded answers with exact source references.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Ask CollegeAI Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gray-800/80 hover:bg-gray-800 text-gray-200 border border-gray-700/80 font-semibold flex items-center justify-center transition-all"
            >
              Admin Portal
            </Link>
          </div>

        </div>
      </section>

      {/* RAG Logical Pipeline Visualization Section */}
      <section className="py-16 bg-gray-900/60 border-y border-gray-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How CollegeAI RAG Architecture Works</h2>
            <p className="text-sm text-gray-400 mt-2">Unlike generic LLMs, CollegeAI uses actual vector search over official college documents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div className="glass-card p-6 rounded-2xl relative space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">1</div>
              <FileText className="w-6 h-6 text-indigo-400" />
              <h3 className="font-bold text-gray-100">Document Upload & Parsing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Admins upload official PDFs and notices. Text is extracted, cleaned, and split into overlapping chunks.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl relative space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">2</div>
              <Database className="w-6 h-6 text-purple-400" />
              <h3 className="font-bold text-gray-100">Vector Embeddings</h3>
              <p className="text-xs text-gray-400 leading-relaxed">High-dimensional embeddings are generated and stored in Supabase PostgreSQL using pgvector.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl relative space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">3</div>
              <Search className="w-6 h-6 text-emerald-400" />
              <h3 className="font-bold text-gray-100">Semantic Search</h3>
              <p className="text-xs text-gray-400 leading-relaxed">User questions are embedded and compared using cosine similarity to retrieve the top-K relevant chunks.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl relative space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">4</div>
              <Cpu className="w-6 h-6 text-amber-400" />
              <h3 className="font-bold text-gray-100">Grounded Answer & Sources</h3>
              <p className="text-xs text-gray-400 leading-relaxed">The LLM receives strictly retrieved college context to generate verified answers with page citations.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h3 className="text-lg font-bold text-gray-100">Zero Hallucinations Guarantee</h3>
            <p className="text-sm text-gray-400">If requested details are not present in official documents, CollegeAI explicitly informs students rather than inventing fake rules or dates.</p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 space-y-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            <h3 className="text-lg font-bold text-gray-100">Categorized Knowledge</h3>
            <p className="text-sm text-gray-400">Organized into 14+ extensible categories including Admissions, Fees, Examinations, Hostel, Scholarships, and Placements.</p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 space-y-3">
            <CheckCircle2 className="w-8 h-8 text-purple-400" />
            <h3 className="text-lg font-bold text-gray-100">Admin Document Management</h3>
            <p className="text-sm text-gray-400">Complete control panel for administrators to upload, process, inspect chunk vectors, and update college resources.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-8 px-4 text-center text-xs text-gray-500">
        <p>CollegeAI — Specification-Driven RAG Application</p>
      </footer>

    </div>
  );
}
