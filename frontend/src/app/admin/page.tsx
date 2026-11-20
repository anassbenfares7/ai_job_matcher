'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

interface ResumeExperience {
  role?: string;
  company?: string;
  duration?: string;
  description?: string;
}

interface ResumeEducation {
  degree?: string;
  institution?: string;
  year?: string;
}

interface ResumeProfile {
  fullName?: string;
  summary?: string;
  skills?: string[];
  experience?: ResumeExperience[];
  education?: ResumeEducation[];
}

interface AdminUser {
  id: string;
  email: string;
  isApproved: boolean;
  isSuspended: boolean;
  createdAt: string;
  resume: {
    id: string;
    createdAt: string;
    profile: ResumeProfile;
  } | null;
}

const PAGE_SIZE = 20;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const response = await api.get('/admin/users', {
      params: { page, search },
    });
    return response.data.data;
  }, [page, search]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setErrorMessage('');
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      setUsers([]);
      setErrorMessage(
        getErrorMessage(error, "We couldn't load the user list. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    let active = true;
    fetchUsers()
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        setTotal(data.total);
        setErrorMessage('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setUsers([]);
        setErrorMessage(
          getErrorMessage(error, "We couldn't load the user list. Please try again.")
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, router, fetchUsers]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setLoading(true);
    setPage(1);
    if (nextSearch === search && page === 1) {
      void loadUsers();
    } else {
      setSearch(nextSearch);
    }
  };

  const approveUser = async (target: AdminUser) => {
    if (!window.confirm(`Approve ${target.email}? They will be able to sign in.`)) return;
    setBusyUserId(target.id);
    setNotice('');
    try {
      await api.post(`/admin/users/${target.id}/approve`);
      setNotice(`${target.email} can now sign in.`);
      setLoading(true);
      await loadUsers();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "We couldn't update this account."));
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleSuspension = async (target: AdminUser) => {
    const suspended = !target.isSuspended;
    const action = suspended ? 'Suspend' : 'Restore access for';
    if (!window.confirm(`${action} ${target.email}?`)) return;
    setBusyUserId(target.id);
    setNotice('');
    try {
      await api.patch(`/admin/users/${target.id}/suspension`, { suspended });
      setNotice(suspended ? `${target.email} was suspended.` : `${target.email} can sign in again.`);
      setLoading(true);
      await loadUsers();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "We couldn't update this account."));
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async () => {
    if (
      !pendingDelete ||
      deleteConfirmation.trim().toLowerCase() !== pendingDelete.email.toLowerCase()
    ) {
      return;
    }

    setBusyUserId(pendingDelete.id);
    setNotice('');
    try {
      await api.delete(`/admin/users/${pendingDelete.id}`);
      setNotice(`${pendingDelete.email} and its saved CV profile were permanently deleted.`);
      setPendingDelete(null);
      setDeleteConfirmation('');
      setLoading(true);
      if (users.length === 1 && page > 1) setPage(page - 1);
      else await loadUsers();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "We couldn't delete this account."));
    } finally {
      setBusyUserId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </main>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-50 text-main">
      <header className="border-b border-border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Users className="h-5 w-5 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="font-serif text-lg font-bold leading-tight sm:text-xl">Admin dashboard</p>
              <p className="max-w-[65vw] truncate text-xs text-muted sm:max-w-none">{user.email}</p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="min-h-10 flex-1 rounded-lg border border-border-line px-3 text-sm font-medium hover:bg-slate-50 sm:flex-none"
            >
              User dashboard
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <section className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">People and CVs</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Users</h1>
            <p className="mt-2 text-sm text-muted">
              {total} {total === 1 ? 'account' : 'accounts'} · CVs show parsed details only; original files aren&apos;t saved.
            </p>
          </div>
          <form onSubmit={applySearch} className="flex w-full gap-2 sm:max-w-sm">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search by email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by email"
                className="min-h-11 w-full rounded-lg border border-border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-main px-4 text-sm font-semibold text-white hover:bg-accent"
            >
              Search
            </button>
          </form>
        </section>

        {notice && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading users...
          </div>
        ) : users.length === 0 ? (
          errorMessage ? null : (
            <div className="rounded-2xl border border-dashed border-border-line bg-white px-5 py-14 text-center">
              <Users className="mx-auto mb-3 h-7 w-7 text-muted" />
              <h2 className="font-semibold">No users found</h2>
              <p className="mt-1 text-sm text-muted">
                {search ? 'Try another email search.' : 'New accounts will appear here.'}
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {users.map((target) => {
              const profile = target.resume?.profile;
              const isSelf = target.id === user.id;
              const skills = Array.isArray(profile?.skills) ? profile.skills : [];
              const experience = Array.isArray(profile?.experience) ? profile.experience : [];
              const education = Array.isArray(profile?.education) ? profile.education : [];

              return (
                <article key={target.id} className="min-w-0 rounded-2xl border border-border-line bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words font-semibold leading-snug">
                        {profile?.fullName || target.email}
                      </h2>
                      <p className="mt-1 break-all text-sm text-muted">{target.email}</p>
                    </div>
                    {isSelf && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted">
                        You
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      target.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {target.isApproved ? 'Approved' : 'Pending approval'}
                    </span>
                    {target.isSuspended && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        Suspended
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <p>Joined {formatDate(target.createdAt)}</p>
                    <p>{target.resume ? `CV added ${formatDate(target.resume.createdAt)}` : 'No CV uploaded'}</p>
                  </div>

                  {target.resume && (
                    <details className="mt-4 border-t border-border-line pt-3">
                      <summary className="cursor-pointer py-1 text-sm font-semibold text-main outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        View parsed CV details
                      </summary>
                      <div className="mt-3 space-y-4 text-sm">
                        {profile?.summary && (
                          <p className="whitespace-pre-wrap leading-relaxed text-muted">{profile.summary}</p>
                        )}
                        {skills.length > 0 && (
                          <div>
                            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Skills</h3>
                            <div className="flex flex-wrap gap-1.5">
                              {skills.map((skill, index) => (
                                <span key={`${skill}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {experience.length > 0 && (
                          <div>
                            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Experience</h3>
                            <ul className="space-y-2">
                              {experience.map((item, index) => (
                                <li key={`${item.role || 'role'}-${index}`}>
                                  <p className="font-medium">{item.role || 'Role not listed'}</p>
                                  <p className="text-xs text-muted">
                                    {[item.company, item.duration].filter(Boolean).join(' · ')}
                                  </p>
                                  {item.description && <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {education.length > 0 && (
                          <div>
                            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Education</h3>
                            <ul className="space-y-1">
                              {education.map((item, index) => (
                                <li key={`${item.degree || 'education'}-${index}`} className="text-xs">
                                  <span className="font-medium">{item.degree || 'Education'}</span>
                                  <span className="text-muted">
                                    {item.institution ? ` · ${item.institution}` : ''}
                                    {item.year ? ` · ${item.year}` : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {!profile?.summary && skills.length === 0 && experience.length === 0 && education.length === 0 && (
                          <p className="text-xs text-muted">No parsed CV details are available.</p>
                        )}
                      </div>
                    </details>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-2 border-t border-border-line pt-4 sm:grid-cols-2">
                    {!target.isApproved && !target.isSuspended && !isSelf && (
                      <button
                        type="button"
                        disabled={busyUserId === target.id}
                        onClick={() => void approveUser(target)}
                        className="min-h-10 rounded-lg bg-main px-3 py-2 text-xs font-semibold text-white hover:bg-accent disabled:opacity-50"
                      >
                        Approve account
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={busyUserId === target.id}
                        onClick={() => void toggleSuspension(target)}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border-line px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        {target.isSuspended ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                        {target.isSuspended ? 'Restore access' : 'Suspend'}
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={busyUserId === target.id}
                        onClick={() => {
                          setPendingDelete(target);
                          setDeleteConfirmation('');
                        }}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:col-span-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Permanently delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <nav aria-label="User pages" className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current - 1);
                }}
                className="flex min-h-10 items-center gap-1 rounded-lg border border-border-line bg-white px-3 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current + 1);
                }}
                className="flex min-h-10 items-center gap-1 rounded-lg border border-border-line bg-white px-3 text-sm disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </nav>
        )}
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <h2 id="delete-user-title" className="text-lg font-bold text-red-700">
              Permanently delete this account?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This also deletes the user&apos;s parsed CV profile and saved matches. This cannot be undone.
            </p>
            <label className="mt-4 block text-sm font-medium" htmlFor="delete-confirmation">
              Type <span className="break-all font-bold">{pendingDelete.email}</span> to confirm
            </label>
            <input
              id="delete-confirmation"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-border-line px-3 text-sm outline-none focus:border-red-500"
            />
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteConfirmation('');
                }}
                className="min-h-11 rounded-lg border border-border-line px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busyUserId === pendingDelete.id ||
                  deleteConfirmation.trim().toLowerCase() !== pendingDelete.email.toLowerCase()
                }
                onClick={() => void deleteUser()}
                className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busyUserId === pendingDelete.id ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
