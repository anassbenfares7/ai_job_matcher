'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import AuthHeader from '@/components/auth/AuthHeader';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('Verifying your email address…');
  const ranOnce = useRef(false);

  useEffect(() => {
    // React 18+ runs effects twice in dev; the token is single-use, so guard it.
    if (ranOnce.current) return;
    ranOnce.current = true;

    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    (async () => {
      try {
        const res = await api.post('/auth/verify-email', { token });
        const { token: sessionToken, user } = res.data.data;
        login(sessionToken, user);
        setStatus('success');
        setMessage('Your email is verified. Taking you to your dashboard…');
        setTimeout(() => router.push('/dashboard'), 1500);
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            'We could not verify this link. It may be invalid or already used.',
        );
      }
    })();
  }, [login, router]);

  return (
    <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
      <div className="w-full max-w-sm animate-fade-in text-center">
        <AuthHeader />

        <div className="mt-2 border border-border-line rounded-xl p-8 bg-white flex flex-col items-center gap-4">
          {status === 'verifying' && (
            <Loader2 className="w-7 h-7 text-accent animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-7 h-7 text-red-500" />
          )}

          <p className="text-sm text-muted leading-relaxed font-sans">
            {message}
          </p>

          {status === 'error' && (
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="text-xs font-sans text-muted hover:text-accent font-medium border-b border-transparent hover:border-accent transition-all cursor-pointer"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
