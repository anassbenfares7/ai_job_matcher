'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuthenticationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setFormLoading(true);

    const targetRoute = isLogin ? '/auth/login' : '/auth/register';

    try {
      // Direct call utilizing our centralized Axios client engine
      const res = await api.post(targetRoute, { email, password });
      
      const { token, user } = res.data.data;
      
      // Commit session identifiers globally
      login(token, user);
      
      // Redirect cleanly to the main workspace core dashboard panel
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Portal Communication Exception:', err);
      setErrorMessage(
        err.response?.data?.message || 
        'Network synchronization failure. Please verify your connection parameter logs.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Structural Accent Visual Grid Backing */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />

      <div className="w-full max-w-md relative z-10">
        {/* Core Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-teal-400 text-xs font-medium mb-3 backdrop-blur-md">
            <span>Morocco AI Tech Hub Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">ai_job_matcher</h1>
          <p className="text-sm text-slate-400 mt-2">
            Semantic application engine for the Moroccan tech ecosystem.
          </p>
        </div>

        {/* Dynamic Card Container Box */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-slate-950/50">
          <h2 className="text-xl font-bold text-white mb-6">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400 animate-fade-in">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleAuthenticationSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  disabled={formLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.ma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  disabled={formLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 group disabled:opacity-50 disabled:hover:bg-teal-500 shadow-lg shadow-teal-500/10"
            >
              {formLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Get Started'}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Interface Context Toggle */}
          <div className="mt-6 pt-6 border-t border-slate-800/60 text-center">
            <button
              type="button"
              disabled={formLoading}
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMessage('');
              }}
              className="text-sm text-slate-400 hover:text-teal-400 transition-colors focus:outline-none disabled:opacity-50"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already registered? Log in'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
