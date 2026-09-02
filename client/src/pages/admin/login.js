import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../store/authContext';
import { Shield, Mail, Lock, ArrowRight, AlertCircle, GraduationCap } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const { login, logout } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.role !== 'admin') {
        logout();
        throw new Error('Administrator access required.');
      }
      router.push('/admin');
    } catch (err) {
      setFormError(err.message || 'Admin login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400"><Shield className="w-7 h-7" /></div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Administrator Login</h2>
          <p className="text-sm text-gray-400">Sign in to manage the CollegeAI system</p>
        </div>
        <div className="glass-card p-6 sm:p-8 rounded-2xl">
          {formError && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start space-x-2"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><span>{formError}</span></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Administrator Email</label><div className="relative"><Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="email" required placeholder="admin@college.edu" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors" /></div></div>
            <div><label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Password</label><div className="relative"><Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="password" required placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors" /></div></div>
            <button type="submit" disabled={submitting} className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold shadow-lg shadow-purple-600/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50">{submitting ? <span>Signing In...</span> : <><span>Administrator Sign In</span><ArrowRight className="w-4 h-4" /></>}</button>
          </form>
          <div className="mt-6 text-center text-xs text-gray-400">Are you a student? <Link href="/login" className="text-indigo-400 hover:underline font-semibold">Student Login</Link></div>
        </div>
        <div className="text-center"><Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1"><GraduationCap className="w-4 h-4" />Back to CollegeAI</Link></div>
      </div>
    </div>
  );
}
