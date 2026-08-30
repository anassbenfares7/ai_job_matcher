'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🚀 DYNAMIC SCRIPT INJECTION LOOP: Load the script safely within browser memory
  useEffect(() => {
    const initializeGoogleOAuthIdentityServices = () => {
      if (window.google?.accounts?.id) {
        console.log('⏳ [OAuth Core] Initializing Google Credential Client Matrix...');
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_://googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });
      }
    };

    // Check if the script element is already present in document DOM tree
    const existingScript = document.querySelector('script[src="https://google.com"]');
    
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = "https://google.com";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleOAuthIdentityServices;
      document.head.appendChild(script);
    } else {
      initializeGoogleOAuthIdentityServices();
    }
  }, []);

  // 🚀 GOOGLE TOKEN CREDENTIAL RESPONSE INTERCEPTOR
  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMessage('');
    setFormLoading(true);
    console.log('⏳ [OAuth Handshake] Extracting credential identity token...');

    try {
      // Direct POST call to your REST endpoint carrying the signed identity token parameter
      const res = await api.post('/auth/google', {
        idToken: response.credential
      });

      const { token, user } = res.data.data;
      login(token, user);
      
      console.log('✅ [OAuth Handshake] Session verified. Routing to dashboard workspace...');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('❌ Google Token Validation Exception:', err);
      setErrorMessage(
        err.response?.data?.message || 
        'Google authentication handshake rejected. Please check your Google Client ID configuration variables.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleSignClickTrigger = () => {
    if (window.google?.accounts?.id) {
      setErrorMessage('');
      window.google.accounts.id.prompt(); // Slides open Google One-Tap accounts modal interface overlay sheet
    } else {
      setErrorMessage('Google authentication framework is still loading. Please wait a brief moment and click retry.');
    }
  };

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
      setErrorMessage(err.response?.data?.message || 'Authentication failure. Please check your entries.');
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

        {/* 🚀 PREMIUM MEDIUM-STYLE GOOGLE SIGN-IN BUTTON */}
        <button
          type="button"
          disabled={formLoading}
          onClick={handleGoogleSignClickTrigger}
          className="w-full bg-white hover:bg-slate-50 border border-main text-main font-medium text-sm py-2.5 px-4 rounded-full transition-all duration-150 flex justify-center items-center gap-3 cursor-pointer disabled:opacity-50 select-none"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Minimalist Separator Divider Line */}
        <div className="my-6 flex items-center justify-between text-muted text-xs select-none">
          <div className="w-[42%] h-[1px] bg-border-line" />
          <span className="font-sans font-medium">or</span>
          <div className="w-[42%] h-[1px] bg-border-line" />
        </div>

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
                <span>{isLogin ? 'Sign In with Email' : 'Register with Email'}</span>
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
