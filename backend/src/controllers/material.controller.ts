import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateApplicationMaterials } from '../services/ai.service.js';
import { db } from '../config/database.js';

/**
 * Generate tailored cover letter and resume optimization logs with strict caching
 */
export const getOrGenerateMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { jobId } = req.body;
  const userId = req.user?.id;

  if (!jobId || !userId) {
    return res.status(400).json({
      status: 'error',
      message: 'Payload unfulfilled. Missing target jobId parameter.'
    });
  }

  try {
    console.log(`⏳ [Material Engine] Checking generation cache status for job: ${jobId}`);

    // 1. Optimization Check: Pull any existing row to see if materials are already cached
    const existingMatch = await db.query(
      `SELECT match_score, generated_cover_letter, generated_feedback 
       FROM applications_and_matches 
       WHERE user_id = $1 AND job_posting_id = $2;`,
      [userId, jobId]
    );

    // If cache hits with generated content, return it instantly
    if (existingMatch.rows.length > 0 && existingMatch.rows[0].generated_cover_letter) {
      console.log('✅ [Material Engine] Cache hit! Returning stored materials immediately.');
      return res.status(200).json({
        status: 'success',
        message: 'Tailored application materials retrieved successfully from local cache.',
        data: {
          matchScore: existingMatch.rows[0].match_score,
          coverLetter: existingMatch.rows[0].generated_cover_letter,
          feedback: existingMatch.rows[0].generated_feedback
        }
      });
    }

    console.log('🔍 [Material Engine] Cache miss. Staging external AI generation pipelines...');

    // 2. Fetch the target job posting data
    const jobQuery = await db.query('SELECT title, company, description FROM job_postings WHERE id = $1;', [jobId]);
    if (jobQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'The targeted job posting could not be found.' });
    }
    const job = jobQuery.rows[0];

    // 3. Fetch the candidate's structural resume profile data
    const resumeQuery = await db.query('SELECT structured_data FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;', [userId]);
    if (resumeQuery.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Generation aborted. Please upload a CV profile before generating tailored content.' });
    }
    const profile = resumeQuery.rows[0].structured_data;

    // 4. Fire the structured Gemini generation engine
    const aiMaterials = await generateApplicationMaterials(job.title, job.company, job.description, profile);

    // 5. Save or update the record inside PostgreSQL
    let matchScore = existingMatch.rows[0]?.match_score || 0.7500; // Fallback score if row hasn't been initialized by similarity checker yet

    await db.query(
      `INSERT INTO applications_and_matches (user_id, job_posting_id, match_score, generated_cover_letter, generated_feedback)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, job_posting_id) 
       DO UPDATE SET 
         generated_cover_letter = EXCLUDED.generated_cover_letter,
         generated_feedback = EXCLUDED.generated_feedback;`,
      [userId, jobId, matchScore, aiMaterials.coverLetter, aiMaterials.feedback]
    );

    console.log('✅ [Material Engine] AI materials created and securely committed to cache.');

    return res.status(201).json({
      status: 'success',
      message: 'Tailored application materials generated successfully.',
      data: {
        matchScore,
        coverLetter: aiMaterials.coverLetter,
        feedback: aiMaterials.feedback
      }
    });

  } catch (error) {
    console.error('❌ [Material Engine Failure]:', error);
    next(error);
  }
};
