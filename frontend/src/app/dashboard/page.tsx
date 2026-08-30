'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import {
  Upload,
  Briefcase,
  FileText,
  Sparkles,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Feather,
} from 'lucide-react';

interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  matchPercentage: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();

  // Pipeline execution tracking states
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Generation workspace states
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [feedback, setFeedback] = useState('');

  // Immersive Navigation Scroll Tracking State Hooks
  const [headerTransform, setHeaderTransform] = useState('translateY(0)');
  const lastScrollY = useRef(0);

  // 1. Smart Sticky Header Scroll Interceptor Logic
  useEffect(() => {
    const handleScrollNavigationToggle = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Scrolling Down: Hide header completely
        setHeaderTransform('translateY(-100%)');
      } else {
        // Scrolling Up: Reveal header smoothly
        setHeaderTransform('translateY(0)');
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener(
      'scroll',
      handleScrollNavigationToggle,
      { passive: true }
    );

    return () =>
      window.removeEventListener(
        'scroll',
        handleScrollNavigationToggle
      );
  }, []);

  // Protect the workspace route
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (user) {
      fetchSemanticMatches();
    }
  }, [user, authLoading]);

  const fetchSemanticMatches = async () => {
    setMatchesLoading(true);
    setErrorMessage('');

    try {
      const res = await api.get('/matches');
      setMatches(res.data.data || []);
    } catch (err: any) {
      console.error(
        '❌ Failed to pull semantic matching listings:',
        err
      );
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      if (selectedFile.type !== 'application/pdf') {
        setErrorMessage(
          'Invalid format. Please select a text-selectable PDF document.'
        );
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setErrorMessage('');
    }
  };

  const handleResumeUploadSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!file) return;

    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      await api.post('/resumes/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccessMessage(
        'CV processed and vector space records compiled successfully.'
      );

      setFile(null);

      await fetchSemanticMatches();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          'Failed to analyze multi-modal asset data layers.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateMaterials = async (job: JobMatch) => {
    setErrorMessage('');
    setCoverLetter('');
    setFeedback('');
    setSelectedJob(job);
    setGeneratingId(job.id);

    try {
      const res = await api.post('/materials/generate', {
        jobId: job.id,
      });

      if (res.data && res.data.data) {
        setCoverLetter(
          res.data.data.coverLetter || ''
        );

        setFeedback(
          res.data.data.feedback || ''
        );
      }

      setGeneratingId(null);
    } catch (err: any) {
      if (
        err.code === 'ECONNABORTED' ||
        err.message?.includes('timeout')
      ) {
        setTimeout(async () => {
          try {
            const retryRes = await api.post(
              '/materials/generate',
              { jobId: job.id }
            );

            if (retryRes.data && retryRes.data.data) {
              setCoverLetter(
                retryRes.data.data.coverLetter || ''
              );

              setFeedback(
                retryRes.data.data.feedback || ''
              );
            }
          } catch (retryErr) {
            setErrorMessage(
              'Pipeline is processing context. Wait a moment and click re-generate.'
            );
          } finally {
            setGeneratingId(null);
          }
        }, 2500);
      } else {
        setErrorMessage(
          err.response?.data?.message ||
            'AI model is highly demanded. Please retry.'
        );

        setGeneratingId(null);
      }
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-main font-sans selection:bg-accent/10 relative">

      {/* Global Navigation: Smart Scrolling Header */}
      <header
        style={{ transform: headerTransform }}
        className="fixed top-0 left-0 right-0 h-16 border-b border-border-line bg-white/90 backdrop-blur-md transition-transform duration-300 ease-in-out z-50 flex items-center justify-between px-6"
      >
        <div className="flex items-center gap-3 select-none">
          <Feather className="w-5 h-5 text-accent" />

          <span className="font-serif font-bold text-xl tracking-tight text-main">
            ai_job_matcher
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-xs text-muted font-medium font-sans">
            {user.email}
          </span>

          <button
            onClick={logout}
            className="text-muted hover:text-red-600 transition-colors flex items-center gap-2 text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Structural Balanced Workplace Content Area */}
      <main className="max-w-[1040px] mx-auto px-6 pt-28 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-12">

        {/* Left Column: Recommendations */}
        <div className="lg:col-span-2 space-y-10 border-r border-transparent lg:border-border-line lg:pr-10">

          <div className="border-b border-border-line pb-4 mb-6">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-main">
              Your Tailored Recommendations
            </h2>

            <p className="text-xs text-muted font-sans mt-1">
              Calculated natively via 768-dimensional Cosine Similarity
              algorithms [SQL Query].
            </p>
          </div>

          {matchesLoading ? (
            <div className="flex flex-col justify-center items-center h-48 gap-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />

              <span className="text-xs text-muted font-mono uppercase tracking-widest">
                Scanning Vector Clusters...
              </span>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-border-line rounded-xl bg-slate-50/50">
              <Briefcase className="w-6 h-6 text-muted mx-auto mb-2" />

              <p className="text-sm font-medium text-main">
                No active profile embeddings mapped.
              </p>

              <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                Upload your digital CV onto the right terminal to
                calibrate matching coordinates.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-line">
              {matches.map((job) => (
                <div
                  key={job.id}
                  className="py-6 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start gap-6 group animate-fade-in"
                >
                  {/* Left Side: Meta, Title, Excerpt */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-sans text-muted">
                      <span className="font-semibold text-main">
                        {job.company}
                      </span>

                      <span>·</span>

                      <span>{job.location}</span>
                    </div>

                    <h3 className="font-sans font-bold text-lg text-main group-hover:text-accent transition-colors leading-tight">
                      {job.title}
                    </h3>

                    <p className="text-sm text-muted leading-relaxed line-clamp-2 font-serif">
                      {job.description}
                    </p>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() =>
                          handleGenerateMaterials(job)
                        }
                        disabled={generatingId !== null}
                        className="text-xs text-accent hover:text-main font-bold flex items-center gap-1.5 transition-colors border-b border-transparent hover:border-main pb-0.5 cursor-pointer disabled:opacity-40"
                      >
                        <Sparkles className="w-3.5 h-3.5" />

                        <span>
                          Tailor Application View
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Right Side: Match Metric */}
                  <div className="flex-shrink-0 text-right">
                    <span
                      className={`inline-block px-3 py-1.5 rounded-md text-sm font-bold ${
                        job.matchPercentage >= 80
                          ? 'bg-emerald-50 text-emerald-600'
                          : job.matchPercentage >= 60
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {job.matchPercentage}%
                    </span>

                    <span className="block text-[10px] text-muted uppercase tracking-wider mt-1">
                      Match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Core Action Control Panel */}
        <div className="space-y-8">

          {/* Portfolio CV Drop Terminal */}
          <div className="border border-border-line rounded-xl p-6 bg-slate-50/50">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-4 h-4 text-accent" />

              <h3 className="font-serif font-bold text-lg text-main">
                Portfolio Asset Input
              </h3>
            </div>

            {successMessage && (
              <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />

                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />

                <span>{errorMessage}</span>
              </div>
            )}

            <form
              onSubmit={handleResumeUploadSubmit}
              className="space-y-4"
            >
              <div className="border border-dashed border-border-line hover:border-accent/50 rounded-lg bg-white p-6 text-center transition-colors relative group cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  disabled={uploading}
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <FileText className="w-7 h-7 text-muted group-hover:text-accent transition-colors mx-auto mb-2" />

                <span className="block text-xs font-medium text-muted truncate">
                  {file
                    ? file.name
                    : 'Drop selectable resume PDF'}
                </span>
              </div>

              {file && (
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-main hover:bg-accent text-white text-xs font-semibold py-3 px-4 rounded-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Process Vector Embedding
                    </>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      </main>

      {/* Reader Component Modal Canvas */}
      {selectedJob &&
        (coverLetter || feedback || generatingId) && (
          <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">

            <div className="relative bg-white w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl border border-border-line">

              {/* Control Panel Close Key */}
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setCoverLetter('');
                  setFeedback('');
                }}
                className="absolute top-4 right-4 text-xs text-muted hover:text-main font-bold uppercase tracking-wider cursor-pointer border border-border-line px-3 py-1.5 rounded-full bg-white transition-colors z-10"
              >
                Close Reader
              </button>

              {generatingId ? (
                <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 p-10">
                  <Loader2 className="w-7 h-7 text-accent animate-spin" />

                  <p className="text-sm text-muted font-serif">
                    Drafting Review Assets via Gemini...
                  </p>
                </div>
              ) : (
                <div className="p-8 md:p-12">

                  {/* 1. Meta / Author Header Block */}
                  <div className="mb-8 border-b border-border-line pb-6">
                    <span className="text-[10px] uppercase tracking-widest text-accent font-bold">
                      Application Blueprint
                    </span>

                    <h2 className="font-serif text-3xl font-bold text-main mt-2 pr-24">
                      Application Blueprint for {selectedJob.title}
                    </h2>

                    <p className="text-sm text-muted mt-3 max-w-2xl leading-relaxed">
                      Customized cover letter framing variables matched
                      directly to {selectedJob.company}'s operational criteria.
                    </p>
                  </div>

                  {/* 2. Cover Letter */}
                  {coverLetter && (
                    <section className="mb-8">
                      <h3 className="font-serif text-xl font-bold text-main mb-4">
                        Section I: Bespoke Cover Letter
                      </h3>

                      <div className="border border-border-line rounded-lg bg-slate-50 p-6 text-sm text-main leading-7 whitespace-pre-wrap">
                        {coverLetter}
                      </div>
                    </section>
                  )}

                  {/* 3. ATS Feedback */}
                  {feedback && (
                    <section>
                      <h3 className="font-serif text-xl font-bold text-main mb-4">
                        Section II: ATS Optimization Feedback
                      </h3>

                      <blockquote className="border-l-4 border-accent bg-slate-50 p-6 text-sm text-muted leading-7 whitespace-pre-wrap">
                        {feedback}
                      </blockquote>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}