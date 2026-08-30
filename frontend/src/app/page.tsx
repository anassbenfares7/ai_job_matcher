'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // 1. Wait patiently for the AuthContext cookie-hydration lifecycle to complete
    if (loading) return;

    // 2. Automated Gateway Routing Guard
    if (user) {
      console.log('🔒 [Route Guard] Active session token validated. Redirecting to user panel layout dashboard...');
      router.replace('/dashboard');
    } else {
      console.log('🔓 [Route Guard] Anonymous session detected. Routing user context directly to auth portal...');
      router.replace('/auth');
    }
  }, [user, loading, router]);

  // Render a clean, stylized baseline brand loader while the token handshakes settle in memory
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center gap-3">
      <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      <span className="text-xs text-slate-500 font-medium tracking-wider uppercase font-mono">
        Initializing Security Matrices...
      </span>
    </main>
  );
}
