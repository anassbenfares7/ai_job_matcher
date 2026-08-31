'use client';

import React, { useState } from 'react';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

interface EmailAuthFormProps {
  isLogin: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
  loading: boolean;
}

export default function EmailAuthForm({ isLogin, onSubmit, loading }: EmailAuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit(email, password);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div>
        <label className="block text-[11px] font-bold text-main uppercase tracking-wider mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="email"
            required
            disabled={loading}
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
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white border-b border-border-line focus:border-main py-2 pl-7 pr-2 text-sm text-main placeholder-slate-300 focus:outline-none transition-colors disabled:opacity-50 font-sans"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 bg-main hover:bg-main/90 text-white font-medium text-sm py-2.5 px-4 rounded-full transition-all duration-150 flex justify-center items-center gap-2 group disabled:opacity-50 cursor-pointer select-none"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <>
            <span>{isLogin ? 'Sign In with Email' : 'Register with Email'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}
