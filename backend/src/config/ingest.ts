import { db } from './database.js';
import { generateEmbedding } from '../services/ai.service.js';
import { fetchJobsFromJooble } from '../services/jobs.service.js';

/**
 * Pull real job listings from the free Jooble API, embed them, and store them.
 *
 * Run with:  npm run ingest
 *
 * This replaces the hand-written mock list in seed.ts. seed.ts is kept only as
 * an offline fallback when there is no Jooble key / no network.
 */

// The API has no "all jobs" endpoint — you can only search by keyword, so we run
// one search per broad field. Kept short on purpose: each term costs API requests
// (free-tier quota) + one embedding call per new job. Add more terms here anytime
// (e.g. call center, enseignement, tourisme, BTP, juridique) — the only cost is a
// slower run and more quota used.
const SEARCH_TERMS = [
  'informatique',
  'marketing communication',
  'finance comptabilité',
  'ressources humaines',
  'commercial vente',
  'ingénierie',
  'logistique supply chain',
  'santé',
];

const LOCATION = 'Morocco';

// Gemini's free embedding tier is rate-limited per minute. A short pause between
// calls keeps us comfortably under it.
const EMBED_DELAY_MS = 1200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ingestJobs() {
  console.log('🚀 [Ingest] Fetching real job listings from Jooble...');

  let savedCount = 0;
  let skippedExisting = 0;
  let failedEmbeds = 0;

  try {
    for (const term of SEARCH_TERMS) {
      console.log(`\n🔎 [Jooble] "${term}" in ${LOCATION}`);

      const jobs = await fetchJobsFromJooble(term, LOCATION);
      console.log(`   → ${jobs.length} listings returned`);

      for (const job of jobs) {
        // Already have this exact listing from a previous run? Skip it.
        const existing = await db.query(
          'SELECT id FROM job_postings WHERE external_id = $1;',
          [job.externalId],
        );
        if (existing.rows.length > 0) {
          skippedExisting += 1;
          continue;
        }

        const synthesisInput = `Job Title: ${job.title}. Location: ${job.location}. Company: ${job.company}. Job Summary: ${job.description}`;

        let vectorArray: number[];
        try {
          vectorArray = await generateEmbedding(synthesisInput);
        } catch {
          failedEmbeds += 1;
          console.warn(`   ⚠️  Embedding failed, skipped: ${job.title}`);
          continue;
        }

        const pgVectorString = `[${vectorArray.join(',')}]`;

        await db.query(
          `INSERT INTO job_postings
             (external_id, title, company, location, description, apply_url, source, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
           ON CONFLICT (external_id) DO NOTHING;`,
          [
            job.externalId,
            job.title,
            job.company,
            job.location,
            job.description,
            job.applyUrl,
            job.source,
            pgVectorString,
          ],
        );

        savedCount += 1;
        console.log(`   ✅ ${job.title} @ ${job.company}`);

        await sleep(EMBED_DELAY_MS);
      }
    }

    console.log(
      `\n✅ [Ingest] Done. ${savedCount} new, ${skippedExisting} already existed, ${failedEmbeds} embed failures.`,
    );
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Ingest] Aborted:', error);
    process.exit(1);
  }
}

ingestJobs();
