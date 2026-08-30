import React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authContext';
import { User, Mail, Shield, Key, LogOut, Settings as SettingsIcon, Database, Sliders } from 'lucide-react';

export default function Settings() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) return null;

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-indigo-400" />
          <span>Account & Application Settings</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage user session profile, permissions, and RAG search preferences.</p>
      </div>

      {/* User Profile Card */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
        <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
          <User className="w-5 h-5 text-indigo-400" />
          <span>Profile Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Full Name</span>
            <p className="font-semibold text-gray-100">{user.name}</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Email Address</span>
            <p className="font-semibold text-gray-100">{user.email}</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Assigned Role</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-300 capitalize">{user.role}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">User ID</span>
            <p className="font-mono text-xs text-gray-400 truncate">{user.id}</p>
          </div>
        </div>
      </div>

      {/* RAG Engine Preferences */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <span>RAG Configuration Defaults</span>
        </h2>

        <div className="space-y-3 text-xs text-gray-300">
          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-200">Default Chunks Retrieved (TOP_K)</p>
              <p className="text-gray-500">Top matching document passages passed to LLM context</p>
            </div>
            <span className="px-3 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">5 Chunks</span>
          </div>

          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-200">Similarity Match Threshold</p>
              <p className="text-gray-500">Minimum relevance score threshold for vector similarity</p>
            </div>
            <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">0.10 Cosine</span>
          </div>
        </div>
      </div>

      {/* Session Controls */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-100">Active Session</h3>
          <p className="text-xs text-gray-400">Authenticated via JWT Token</p>
        </div>

        <button
          onClick={logout}
          className="px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-sm font-semibold flex items-center space-x-2 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

    </div>
  );
}
