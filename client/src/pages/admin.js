import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authContext';
import { adminApi } from '../services/api';
import StatCard from '../components/StatCard';
import { FileText, Users, MessageSquare, Database, Activity, ShieldAlert, Cpu, CheckCircle2, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState(null);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/chat');
      } else {
        fetchAdminData();
      }
    }
  }, [user, isAdmin, authLoading]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes] = await Promise.all([
        adminApi.getAnalytics(),
        adminApi.getUsers()
      ]);

      if (analyticsRes.success && analyticsRes.data?.analytics) {
        setAnalytics(analyticsRes.data.analytics);
      }
      if (usersRes.success && usersRes.data?.users) {
        setUserList(usersRes.data.users);
      }
    } catch (err) {
      setError(err.message || 'Failed to load admin analytics');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const dash = analytics?.dashboard || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin System Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of knowledge base coverage, active users, vector indices, and system metrics.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Documents"
          value={dash.totalDocuments ?? 0}
          icon={FileText}
          description="Uploaded official files"
          color="indigo"
        />
        <StatCard
          title="Total Users"
          value={dash.totalUsers ?? 0}
          icon={Users}
          description="Registered students & admins"
          color="emerald"
        />
        <StatCard
          title="Questions Asked"
          value={dash.totalQuestions ?? 0}
          icon={MessageSquare}
          description="RAG queries processed"
          color="amber"
        />
        <StatCard
          title="Vector Chunks"
          value={dash.totalVectorChunks ?? 0}
          icon={Database}
          description="Indexed embeddings in pgvector"
          color="rose"
        />
      </div>

      {/* Knowledge Base Category Distribution & System Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Category Breakdown Card */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Knowledge Base Category Breakdown</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {analytics?.categoryDistribution?.map((cat) => (
              <div
                key={cat.category}
                className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 flex flex-col justify-between"
              >
                <span className="text-xs text-gray-400 font-medium truncate">{cat.category}</span>
                <span className="text-xl font-bold text-gray-100 mt-1">{cat.count} docs</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Info */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>Engine & RAG Status</span>
          </h2>

          <div className="space-y-3 text-xs text-gray-300">
            <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
              <span className="text-gray-400">Database Engine:</span>
              <span className="font-semibold text-gray-200">Supabase pgvector</span>
            </div>

            <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
              <span className="text-gray-400">Embedding Model:</span>
              <span className="font-semibold text-gray-200">text-embedding-3-small</span>
            </div>

            <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
              <span className="text-gray-400">Similarity Metric:</span>
              <span className="font-semibold text-emerald-400">Cosine Distance</span>
            </div>

            <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between">
              <span className="text-gray-400">System Health:</span>
              <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Operational</span>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden space-y-4 p-6">
        <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <span>Registered System Users ({userList.length})</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/90 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-semibold">User Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Registered On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {userList.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-semibold text-gray-200">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      u.role === 'admin'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
