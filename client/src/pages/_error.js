import React from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

function Error({ statusCode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {statusCode ? `An error ${statusCode} occurred on server` : 'An error occurred on client'}
        </h1>
        <p className="text-sm text-gray-400">
          We encountered an unexpected error. Please refresh or return to home.
        </p>
        <div className="pt-2 flex justify-center">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
