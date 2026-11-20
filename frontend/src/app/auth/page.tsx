'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

import AuthHeader from '@/components/auth/AuthHeader';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Set after a successful registration — switches to the "pending approval" view.
  const [justRegistered, setJustRegistered] = useState(false);

  const handleAuthError = (err: unknown, fallback: string) => {
    const response = axios.isAxiosError<{ code?: string; message?: string }>(err)
      ? err.response?.data
      : undefined;

    if (response?.code === 'PENDING_APPROVAL') {
      setErrorMessage(
        response.message ||
          'Your account is awaiting admin approval. Please check back later.',
      );
      return;
    }
    setErrorMessage(response?.message || fallback);
  };

  const handleEmailAuthentication = async (email: string, password: string) => {
    setErrorMessage('');
    setFormLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        const { token, user } = res.data.data;
        login(token, user);
        router.push('/dashboard');
      } else {
        await api.post('/auth/register', { email, password });
        setJustRegistered(true);
      }
    } catch (err: unknown) {
      console.error('❌ Email Auth Gateway Exception:', err);
      handleAuthError(err, 'Authentication failed. Please verify credentials.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleOAuthSuccess = async (idToken: string) => {
    setErrorMessage('');
    setFormLoading(true);

    try {
      const res = await api.post('/auth/google', { idToken });
      const { token, user } = res.data.data;
      login(token, user);
      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('❌ Google Token Validation Exception:', err);
      handleAuthError(
        err,
        'Google token signature verification failed. Confirm backend credentials alignment.',
      );
    } finally {
      setFormLoading(false);
    }
  };

  // --- View: pending approval after registration ---
  if (justRegistered) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 py-8 text-main selection:bg-accent/10 sm:px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <AuthHeader />

          <div className="mt-2 rounded-xl border border-border-line bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-accent" />
              <h2 className="font-serif text-lg font-bold text-main">
                Account pending approval
              </h2>
            </div>

            <p className="text-sm text-muted leading-relaxed font-sans">
              Thanks for signing up. An admin will review your account shortly.
              You&apos;ll be able to sign in once it&apos;s approved — check back later.
            </p>

            <button
              type="button"
              onClick={() => {
                setJustRegistered(false);
                setIsLogin(true);
                setErrorMessage('');
              }}
              className="mt-5 text-xs font-sans text-muted hover:text-accent font-medium border-b border-transparent hover:border-accent transition-all cursor-pointer"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- View: normal auth form ---
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 py-8 text-main selection:bg-accent/10 sm:px-6">
      <div className="w-full max-w-sm animate-fade-in">

        <AuthHeader />

        {errorMessage && (
          <div className="mb-6 p-4 text-xs font-sans border-l-2 border-accent bg-emerald-50/50 text-main whitespace-pre-wrap">
            {errorMessage}
          </div>
        )}

        <GoogleAuthButton
          onSuccess={handleGoogleOAuthSuccess}
          onFailure={(message) => setErrorMessage(message)}
          disabled={formLoading}
        />

        <div className="my-6 flex items-center justify-between text-muted text-xs select-none">
          <div className="w-[42%] h-[1px] bg-border-line" />
          <span className="font-sans font-medium">or</span>
          <div className="w-[42%] h-[1px] bg-border-line" />
        </div>

        <EmailAuthForm
          isLogin={isLogin}
          onSubmit={handleEmailAuthentication}
          loading={formLoading}
        />

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
