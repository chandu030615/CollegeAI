import React from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';

export default function Custom404() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
          <HelpCircle className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">404 — Page Not Found</h1>
        <p className="text-sm text-gray-400">
          The requested page could not be found in CollegeAI.
        </p>
        <div className="pt-2 flex justify-center">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
