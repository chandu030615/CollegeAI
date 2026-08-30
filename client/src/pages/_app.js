import React from 'react';
import Head from 'next/head';
import { AuthProvider } from '../store/authContext';
import Navbar from '../components/Navbar';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>CollegeAI — RAG-Based College Knowledge Assistant</title>
        <meta name="description" content="AI-powered college knowledge assistant using Retrieval-Augmented Generation (RAG) to provide grounded answers from official college documents." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-radial-gradient text-gray-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Component {...pageProps} />
        </main>
      </div>
    </AuthProvider>
  );
}
