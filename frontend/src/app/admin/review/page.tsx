'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
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

    let active = true;
    const loadReview = async () => {
      if (!token) throw new Error('This review link is missing its token.');
      const res = await api.get<{ data: SignupInfo }>('/auth/review', { params: { token } });
      return res.data.data;
    };

    loadReview()
      .then((signupInfo) => {
        if (!active) return;
        setInfo(signupInfo);
        setPhase('review');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPhase('error');
        setMessage(
          !token
            ? 'This review link is missing its token.'
            : axios.isAxiosError<{ message?: string }>(error)
              ? error.response?.data?.message || 'This review link is invalid or has already been used.'
              : 'This review link is invalid or has already been used.',
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const act = async (path: '/auth/approve' | '/auth/reject') => {
    if (!tokenRef.current) return;
    setActing(true);
    try {
      const res = await api.post(path, { token: tokenRef.current });
      setMessage(res.data.message);
      setPhase('done');
    } catch (err: unknown) {
      setPhase('error');
      setMessage(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message || 'Something went wrong. Try the link again.'
          : 'Something went wrong. Try the link again.',
      );
    } finally {
      setActing(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 py-8 text-main selection:bg-accent/10 sm:px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <AuthHeader />

        <div className="mt-2 rounded-xl border border-border-line bg-white p-5 sm:p-6">
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
                <div className="flex flex-col gap-3 sm:flex-row">
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
