'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { api } from '../services/api.js';

interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initial configuration check: Hydrate user data from localStorage/Cookies on application mount
  useEffect(() => {
    const savedToken = Cookies.get('ai_job_matcher_token');
    const savedUser = localStorage.getItem('ai_job_matcher_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // 2. Clear state and record session on successful registration or login
  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    
    // Save session indicators securely across subdomains for 7 full days
    Cookies.set('ai_job_matcher_token', newToken, { expires: 7, secure: true, sameSite: 'strict' });
    localStorage.setItem('ai_job_matcher_user', JSON.stringify(userData));
  };

  // 3. Scrub session indicators cleanly during logouts
  const logout = () => {
    setToken(null);
    setUser(null);
    Cookies.remove('ai_job_matcher_token');
    localStorage.removeItem('ai_job_matcher_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Export a secure utility hook to tap state metrics inside dashboard components instantly
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be executed within an explicit structural AuthProvider block.');
  }
  return context;
};
