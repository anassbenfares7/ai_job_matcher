'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

// Import our newly engineered atomic auth layout sub-components smoothly
import AuthHeader from '@/components/auth/AuthHeader';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🚀 HANDLER 1: Process traditional credential form streams
  const handleEmailAuthentication = async (email: string, password: string) => {
    setErrorMessage('');
    setFormLoading(true);
    const targetRoute = isLogin ? '/auth/login' : '/auth/register';

    try {
      const res = await api.post(targetRoute, { email, password });
      const { token, user } = res.data.data;
      login(token, user);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Email Auth Gateway Exception:', err);
      setErrorMessage(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setFormLoading(false);
    }
  };

  // 🚀 HANDLER 2: Process validated Google Identity credentials
  const handleGoogleOAuthSuccess = async (idToken: string) => {
    setErrorMessage('');
    setFormLoading(true);
    console.log('⏳ [OAuth Pipeline] Forwarding payload signature to REST API handler...');

    try {
      const res = await api.post('/auth/google', { idToken });
      const { token, user } = res.data.data;
      login(token, user);
      console.log('✅ [OAuth Pipeline] Handshake verified. Entry allowed.');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Google Token Validation Exception:', err);
      setErrorMessage(
        err.response?.data?.message || 
        'Google token signature verification failed. Confirm backend credentials alignment.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleOAuthFailureAlert = (message: string) => {
    setErrorMessage(message);
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col justify-center items-center px-6 text-main selection:bg-accent/10">
      <div className="w-full max-w-sm animate-fade-in">
        
        {/* Component 1: Brand Title Layout */}
        <AuthHeader />

        {/* Dynamic Context Failure Messages Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 text-xs font-sans border-l-2 border-accent bg-emerald-50/50 text-main whitespace-pre-wrap">
            {errorMessage}
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
