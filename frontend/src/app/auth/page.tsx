'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

// Import our newly engineered atomic auth layout sub-components smoothly
import AuthHeader from '@/components/auth/AuthHeader';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

type ResendState = 'idle' | 'sending' | 'sent';

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Email address that just registered — switches the view to "check your inbox".
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Email address whose login was blocked because it isn't verified yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<ResendState>('idle');

  // 🚀 HANDLER 1: Process traditional credential form streams
  const handleEmailAuthentication = async (email: string, password: string) => {
    setErrorMessage('');
    setUnverifiedEmail(null);
    setFormLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        const { token, user } = res.data.data;
        login(token, user);
        router.push('/dashboard');
      } else {
        // Register no longer returns a session — the account must be verified first.
        await api.post('/auth/register', { email, password });
        setResendState('idle');
        setPendingEmail(email);
      }
    } catch (err: any) {
      console.error('❌ Email Auth Gateway Exception:', err);

      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email);
        setResendState('idle');
        setErrorMessage(
          err.response.data.message ||
            'Please verify your email address before signing in.',
        );
      } else {
        setErrorMessage(
          err.response?.data?.message ||
            'Authentication failed. Please verify credentials.',
        );
      }
    } finally {
      setFormLoading(false);
    }
  };

  // 🚀 HANDLER 2: Process validated Google Identity credentials
  const handleGoogleOAuthSuccess = async (idToken: string) => {
    setErrorMessage('');
    setUnverifiedEmail(null);
    setFormLoading(true);

    try {
      const res = await api.post('/auth/google', { idToken });
      const { token, user } = res.data.data;
      login(token, user);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Google Token Validation Exception:', err);
      setErrorMessage(
        err.response?.data?.message ||
          'Google token signature verification failed. Confirm backend credentials alignment.',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleOAuthFailureAlert = (message: string) => {
    setErrorMessage(message);
  };

  // Shared "resend verification email" action. Backend always answers the same
  // way, so we just show a confirmation regardless.
  const handleResendVerification = async (email: string) => {
    setResendState('sending');
    try {
      await api.post('/auth/resend-verification', { email });
    } catch {
      // Intentionally ignored — the response is deliberately non-committal.
    }
    setResendState('sent');
  };

  // --- View: "check your inbox" after registration ---
  if (pendingEmail) {
    return (
      <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
        <div className="w-full max-w-sm animate-fade-in">
          <AuthHeader />

          <div className="mt-2 border border-border-line rounded-xl p-6 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-accent" />
              <h2 className="font-serif text-lg font-bold text-main">
                Confirm your email
              </h2>
            </div>

            <p className="text-sm text-muted leading-relaxed font-sans">
              We sent a verification link to{' '}
              <span className="font-semibold text-main">{pendingEmail}</span>.
              Click it to activate your account, then sign in.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {resendState === 'sent' ? (
                <p className="text-xs text-accent font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  If that address needs verification, a new link is on its way.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={resendState === 'sending'}
                  onClick={() => handleResendVerification(pendingEmail)}
                  className="text-xs font-sans text-muted hover:text-accent font-medium border-b border-transparent hover:border-accent transition-all self-start disabled:opacity-50 cursor-pointer"
                >
                  {resendState === 'sending'
                    ? 'Sending…'
                    : "Didn't get it? Resend the link"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPendingEmail(null);
                  setIsLogin(true);
                  setErrorMessage('');
                }}
                className="text-xs font-sans text-muted hover:text-accent font-medium border-b border-transparent hover:border-accent transition-all self-start cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --- View: normal auth form ---
  return (
    <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Component 1: Brand Title Layout */}
        <AuthHeader />

        {/* Dynamic Context Failure Messages Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 text-xs font-sans border-l-2 border-accent bg-emerald-50/50 text-main whitespace-pre-wrap">
            {errorMessage}

            {unverifiedEmail && (
              <div className="mt-3">
                {resendState === 'sent' ? (
                  <span className="text-accent font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verification link sent — check your inbox.
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={resendState === 'sending'}
                    onClick={() => handleResendVerification(unverifiedEmail)}
                    className="font-semibold text-accent hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {resendState === 'sending'
                      ? 'Sending…'
                      : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Component 2: Isolated Multi-Modal Google Trigger Button */}
        <GoogleAuthButton
          onSuccess={handleGoogleOAuthSuccess}
          onFailure={handleOAuthFailureAlert}
          disabled={formLoading}
        />

        {/* Minimalist Editorial Separator */}
        <div className="my-6 flex items-center justify-between text-muted text-xs select-none">
          <div className="w-[42%] h-[1px] bg-border-line" />
          <span className="font-sans font-medium">or</span>
          <div className="w-[42%] h-[1px] bg-border-line" />
        </div>

        {/* Component 3: Isolated Traditional Input Data Form Controller */}
        <EmailAuthForm
          isLogin={isLogin}
          onSubmit={handleEmailAuthentication}
          loading={formLoading}
        />

        {/* Interactive Interface Layout Mode Toggle Link */}
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={formLoading}
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMessage('');
              setUnverifiedEmail(null);
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
