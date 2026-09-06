import { env } from '../config/env.js';

/**
 * A job listing after we've cleaned it up and reshaped it into the
 * structure our database + embedding pipeline expects.
 */
export interface NormalizedJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  source: string;
}

const JOOBLE_ENDPOINT = 'https://jooble.org/api/';

// Jooble snippets come back with light HTML (<b>, &nbsp;, ...). Strip it so the
// text we embed and show the user is clean.
const stripHtml = (input: string): string =>
  input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fetch one page of real job listings from the free Jooble API.
 *
 * Docs: https://jooble.org/api/about
 * Request:  POST https://jooble.org/api/<API_KEY>   { keywords, location, page }
 * Response: { totalCount, jobs: [{ id, title, company, location, snippet, link, source, ... }] }
 */
export const fetchJobsFromJooble = async (
  keywords: string,
  location = 'Morocco',
  page = 1,
): Promise<NormalizedJob[]> => {
  if (!env.JOOBLE_API_KEY) {
    throw new Error(
      'JOOBLE_API_KEY is not set. Add it to backend/.env before running the job ingest.',
    );
  }

  const response = await fetch(`${JOOBLE_ENDPOINT}${env.JOOBLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, location, page: String(page) }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jooble API responded ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { jobs?: any[] };
  const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];

  return rawJobs
    .filter((job) => job && job.id && job.title && job.snippet)
    .map((job) => ({
      externalId: String(job.id),
      title: stripHtml(String(job.title)),
      company: job.company ? stripHtml(String(job.company)) : 'Unspecified',
      location: job.location ? stripHtml(String(job.location)) : location,
      description: stripHtml(String(job.snippet)),
      applyUrl: typeof job.link === 'string' ? job.link : '',
      source: job.source ? String(job.source) : 'jooble',
    }));
};
