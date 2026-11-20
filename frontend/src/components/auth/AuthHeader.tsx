'use client';

import React from 'react';

export default function AuthHeader() {
  return (
    <div className="text-center mb-10 select-none">
      <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight text-main sm:text-4xl">
        ai_job_matcher
      </h1>
      <p className="mx-auto max-w-xs text-sm font-sans leading-relaxed text-muted sm:max-w-none">
        The clean semantic application hub for the Moroccan tech ecosystem.
      </p>
    </div>
  );
}
