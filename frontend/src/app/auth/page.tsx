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
      const res = await api.post(targetRoute, { email, password });
      const { token, user } = res.data.data;
      login(token, user);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Portal Communication Exception:', err);
      setErrorMessage(err.response?.data?.message || 'Authentication failure. Please check your entries and try again.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
      <div className="w-full max-w-sm">
        {/* Editorial Brand Header */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-main mb-2 select-none">
            ai_job_matcher
          </h1>
          <p className="text-sm font-sans text-muted leading-relaxed">
            The clean semantic application hub for the Moroccan tech ecosystem.
          </p>
        </div>

        {/* Action Callout Failure Bars */}
        {errorMessage && (
          <div className="mb-6 p-4 text-xs font-sans border-l-2 border-red-600 bg-red-50/50 text-red-700 animate-fade-in">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleAuthenticationSubmit} className="space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-main uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="email"
                required
                disabled={formLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.ma"
                className="w-full bg-white border-b border-border-line focus:border-main py-2 pl-7 pr-2 text-sm text-main placeholder-slate-300 focus:outline-none transition-colors disabled:opacity-50 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-main uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="password"
                required
                disabled={formLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border-b border-border-line focus:border-main py-2 pl-7 pr-2 text-sm text-main placeholder-slate-300 focus:outline-none transition-colors disabled:opacity-50 font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="w-full mt-4 bg-main hover:bg-main/90 text-white font-medium text-sm py-2.5 px-4 rounded-full transition-all duration-150 flex justify-center items-center gap-2 group disabled:opacity-50 cursor-pointer"
          >
            {formLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Get Started'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Interface State Context Toggles */}
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={formLoading}
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMessage('');
            }}
            className="text-xs font-sans text-muted hover:text-accent font-medium border-b border-transparent hover:border-accent transition-all focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {isLogin ? "No account? Create one cleanly" : 'Already registered? Access your session'}
          </button>
        </div>
      </div>
    </main>
  );
}
