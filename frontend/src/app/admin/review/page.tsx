'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, XCircle, Mail, Clock } from 'lucide-react';
import { api } from '@/services/api';
import AuthHeader from '@/components/auth/AuthHeader';

type Phase = 'loading' | 'review' | 'done' | 'error';

interface SignupInfo {
  email: string;
  signedUpAt: string;
  alreadyApproved: boolean;
}

export default function AdminReviewPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('Loading signup…');
  const [info, setInfo] = useState<SignupInfo | null>(null);
  const [acting, setActing] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    tokenRef.current = token;

    if (!token) {
      setPhase('error');
      setMessage('This review link is missing its token.');
      return;
    }

    (async () => {
      try {
        const res = await api.get('/auth/review', { params: { token } });
        setInfo(res.data.data);
        setPhase('review');
      } catch (err: any) {
        setPhase('error');
        setMessage(
          err.response?.data?.message ||
            'This review link is invalid or has already been used.',
        );
      }
    })();
  }, []);

  const act = async (path: '/auth/approve' | '/auth/reject') => {
    if (!tokenRef.current) return;
    setActing(true);
    try {
      const res = await api.post(path, { token: tokenRef.current });
      setMessage(res.data.message);
      setPhase('done');
    } catch (err: any) {
      setPhase('error');
      setMessage(
        err.response?.data?.message || 'Something went wrong. Try the link again.',
      );
    } finally {
      setActing(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
      <div className="w-full max-w-sm animate-fade-in">
        <AuthHeader />

        <div className="mt-2 border border-border-line rounded-xl p-6 bg-white">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <p className="text-sm text-muted font-sans">{message}</p>
            </div>
          )}

          {phase === 'review' && info && (
            <>
              <h2 className="font-serif text-lg font-bold text-main mb-4">
                Review signup
              </h2>

              <div className="space-y-2 text-sm font-sans mb-6">
                <div className="flex items-center gap-2 text-muted">
                  <Mail className="w-4 h-4" />
                  <span className="font-semibold text-main">{info.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(info.signedUpAt).toLocaleString()}</span>
                </div>
              </div>

              {info.alreadyApproved ? (
                <p className="text-xs text-accent font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  This account is already approved.
                </p>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act('/auth/approve')}
                    className="flex-1 bg-main hover:bg-accent text-white text-xs font-semibold py-2.5 px-4 rounded-full transition-all flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act('/auth/reject')}
                    className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold py-2.5 px-4 rounded-full transition-all flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
              <p className="text-sm text-muted font-sans">{message}</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
              <p className="text-sm text-muted font-sans">{message}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
