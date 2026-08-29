'use client';

import React, { useState, useEffect } from 'react';
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

  // Protect the dashboard view at the client route layer
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
      console.error('❌ Failed to pull semantic records:', err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      if (selectedFile.type !== 'application/pdf') {
        setErrorMessage(
          'Invalid type. Please select a valid digital PDF document.'
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
        'CV processed and vector space records updated successfully.'
      );

      setFile(null);

      // Refresh the similarity matrix automatically
      await fetchSemanticMatches();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          'Failed to parse and map asset structural data.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateMaterials = async (job: JobMatch) => {
    setGeneratingId(job.id);
    setSelectedJob(job);
    setCoverLetter('');
    setFeedback('');

    try {
      const res = await api.post('/materials/generate', {
        jobId: job.id,
      });

      setCoverLetter(res.data.data.coverLetter);
      setFeedback(res.data.data.feedback);
    } catch (err: any) {
      console.error('❌ Generation pipeline failure:', err);

      setErrorMessage(
        'Failed to generate application materials. Please try again.'
      );
    } finally {
      setGeneratingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-teal-500/30">
      {/* Structural Top Dashboard Bar */}
      <nav className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-teal-400" />

            <span className="font-bold text-lg tracking-tight">
              ai_job_matcher
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-sm text-slate-400 font-medium">
              {user.email}
            </span>

            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Control Dashboard Column */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-xl">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-teal-400" />
              <span>Upload Portfolio CV</span>
            </h2>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Upload your resume in PDF format. Our RAG compiler parses text
              nodes and generates 768-dimensional tracking matrices instantly.
            </p>

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 text-xs text-teal-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form
              onSubmit={handleResumeUploadSubmit}
              className="space-y-4"
            >
              <div className="border border-dashed border-slate-800 hover:border-teal-500/50 rounded-xl bg-slate-950 p-6 text-center transition-colors relative group cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  disabled={uploading}
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <FileText className="w-8 h-8 text-slate-600 group-hover:text-teal-400 transition-colors mx-auto mb-2" />

                <span className="block text-xs font-medium text-slate-400 truncate">
                  {file
                    ? file.name
                    : 'Select your resume PDF (Max 5MB)'}
                </span>
              </div>

              {file && (
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Process Embeddings</span>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Center/Right Dashboard Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-xl min-h-[500px]">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Briefcase className="w-5 h-5 text-teal-400" />
              <span>AI Semantic Matching Pipeline</span>
            </h2>

            {matchesLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-3">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />

                <span className="text-xs text-slate-500 tracking-wider">
                  Recalibrating similarity matrices...
                </span>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64 border border-dashed border-slate-900 rounded-xl bg-slate-950/20 p-8 text-center">
                <Briefcase className="w-8 h-8 text-slate-700 mb-3" />

                <h3 className="text-sm font-semibold text-slate-300">
                  No active matches loaded
                </h3>

                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Upload a structural PDF resume onto our terminal matrix to
                  activate semantic matching algorithms across Moroccan tech
                  openings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((job) => (
                  <div
                    key={job.id}
                    className="border border-slate-900 bg-slate-950/40 rounded-xl p-5 hover:border-slate-800 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {job.title}
                        </h3>

                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {job.company} •{' '}
                          <span className="text-slate-500">
                            {job.location}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                            job.matchPercentage >= 80
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : job.matchPercentage >= 60
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {job.matchPercentage}% Match
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      {job.description}
                    </p>

                    <button
                      onClick={() =>
                        handleGenerateMaterials(job)
                      }
                      disabled={generatingId !== null}
                      className="inline-flex items-center gap-2 border border-slate-800 hover:border-teal-500/30 bg-slate-900/40 hover:bg-teal-500/5 text-slate-300 hover:text-teal-400 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all disabled:opacity-50"
                    >
                      {generatingId === job.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Tailor Application Materials
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated Materials Terminal Workspace */}
          {selectedJob &&
            (coverLetter || feedback || generatingId) && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-xl">
                <h2 className="text-lg font-bold mb-6">
                  Materials Engine Output for:{' '}
                  <span className="text-teal-400">
                    {selectedJob.title}
                  </span>
                </h2>

                {generatingId ? (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                    Drafting personalized materials via Gemini Flash...
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Letter Block */}
                    {coverLetter && (
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-3">
                          Tailored Cover Letter
                        </h3>

                        <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {coverLetter}
                        </div>
                      </div>
                    )}

                    {/* Feedback Block */}
                    {feedback && (
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-3">
                          ATS Strategy Feedback
                        </h3>

                        <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {feedback}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      </main>
    </div>
  );
}