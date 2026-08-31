'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: any;
    __google_sdk_initialized__?: boolean;
  }
}

interface GoogleAuthButtonProps {
  onSuccess: (idToken: string) => void;
  onFailure: (message: string) => void;
  disabled: boolean;
}

export default function GoogleAuthButton({ onSuccess, onFailure, disabled }: GoogleAuthButtonProps) {
  const nativeButtonRef = useRef<HTMLDivElement>(null);
  const targetScriptSrc = "https://google.com";

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.error('❌ [OAuth] NEXT_PUBLIC_GOOGLE_CLIENT_ID configuration is missing.');
      onFailure('Authentication setup incomplete.');
      return;
    }

    const initGoogleSDKInstance = () => {
      if (!window.google?.accounts?.id) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => onSuccess(response.credential),
          auto_select: false, // Ensures users are prompted rather than autologged silently
        });

        if (nativeButtonRef.current) {
          window.google.accounts.id.renderButton(nativeButtonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "circle",
            width: nativeButtonRef.current.parentElement?.clientWidth || 240
          });
        }

        window.__google_sdk_initialized__ = true;
      } catch (err: any) {
        console.error('❌ [OAuth] Google SDK Initialization Failure:', err);
        onFailure(err.message || 'Failed to initialize sign-in utility.');
      }
    };

    const scriptExists = document.querySelector(`script[src="${targetScriptSrc}"]`);
    if (!scriptExists) {
      const script = document.createElement('script');
      script.src = targetScriptSrc;
      script.async = true;
      script.defer = true;
      script.onload = initGoogleSDKInstance;
      script.onerror = () => {
        onFailure('Google identity service blocked or unreachable.');
      };
      document.head.appendChild(script);
    } else {
      if (window.google?.accounts?.id) {
        initGoogleSDKInstance();
      } else {
        const checkExist = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(checkExist);
            initGoogleSDKInstance();
          }
        }, 50);
        return () => clearInterval(checkExist);
      }
    }
  }, [onSuccess, onFailure]);

  return (
    <div className="w-full flex justify-center py-1">
      <div 
        ref={nativeButtonRef} 
        className={`w-full flex justify-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`} 
      />
    </div>
  );
}
