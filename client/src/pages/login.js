import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authContext';
import { GraduationCap, Mail, Lock, ArrowRight, AlertCircle, Shield, User } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') {
        router.push('/documents');
      } else {
        router.push('/chat');
      }
    } catch (err) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoStudent = () => {
    setEmail('student@college.edu');
    setPassword('student123');
  };

  const fillDemoAdmin = () => {
    setEmail('admin@college.edu');
    setPassword('admin123');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        
        {/* Card Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to CollegeAI</h2>
          <p className="text-sm text-gray-400">Sign in to access your college knowledge assistant</p>
        </div>

        {/* Demo Quick Fill Helper */}
        <div className="glass-panel p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-400 font-medium">Quick Demo Accounts:</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={fillDemoStudent}
              type="button"
              className="px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-gray-700 flex items-center space-x-1"
            >
              <User className="w-3 h-3" />
              <span>Student</span>
            </button>
            <button
              onClick={fillDemoAdmin}
              type="button"
              className="px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-purple-300 border border-gray-700 flex items-center space-x-1"
            >
              <Shield className="w-3 h-3" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-6 sm:p-8 rounded-2xl">
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-indigo-400 hover:underline font-semibold">
              Register here
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
