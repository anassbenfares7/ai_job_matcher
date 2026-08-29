import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/database.js';

/**
 * Perform native pgvector similarity calculation to rank job postings matching user's CV vector
 */
export const getSemanticMatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized execution context. Missing user identifier session markers.'
    });
  }

  try {
    console.log(`⏳ [Matching Engine] Retrieving vector footprint for user: ${userId}`);

    // 1. Fetch the user's latest uploaded resume vector embedding footprint
    const resumeQuery = await db.query(
      'SELECT embedding FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;',
      [userId]
    );

    // Edge Case: If the candidate hasn't uploaded a CV yet, return an elegant empty state response
    if (resumeQuery.rows.length === 0 || !resumeQuery.rows[0].embedding) {
      return res.status(200).json({
        status: 'success',
        message: 'No active profile found. Please upload a CV first to activate semantic job matching.',
        data: []
      });
    }

    const userCVVector = resumeQuery.rows[0].embedding;

    console.log(`⏳ [Vector Query] Running native Cosine Similarity math inside PostgreSQL...`);

    // 2. Perform Cosine Distance lookup (<=>). 
    // Convert Cosine Distance to Similarity Score: (1 - distance)
    const matchQuery = await db.query(
      `SELECT 
        id, 
        title, 
        company, 
        location, 
        description,
        (1 - (embedding <=> $1::vector)) AS match_score
       FROM job_postings
       ORDER BY embedding <=> $1::vector
       LIMIT 10;`,
      [userCVVector]
    );

    // 3. Format the scores safely into readable percentage representations for the frontend
    const rankedMatches = matchQuery.rows.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      matchPercentage: Math.max(0, Math.min(100, Math.round(parseFloat(job.match_score) * 100)))
    }));

    console.log(`✅ [Matching Engine] Successfully ranked and mapped ${rankedMatches.length} semantic matches.`);

    return res.status(200).json({
      status: 'success',
      message: 'Semantic job match recommendations retrieved successfully.',
      data: rankedMatches
    });

  } catch (error) {
    console.error('❌ [Matching Pipeline Failure]:', error);
    next(error);
  }
};
