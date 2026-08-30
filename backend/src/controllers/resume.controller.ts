import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { parseResumeText, generateEmbedding } from '../services/ai.service.js';
import { db } from '../config/database.js';

export const uploadAndParseResume = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // 1. Ensure a file buffer was successfully captured by Multer
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Payload unfulfilled. Please attach a valid PDF document under the field key "resume".'
    });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized execution context. Missing user identifier session markers.'
      });
    }

    console.log(`⏳ [Resume Engine] Processing Multi-Modal Document Stream for user: ${userId}`);

    // 2. Prepare the raw binary buffer layout data for direct Gemini consumption
    const resumePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    console.log(`⏳ [Gemini Core] Invoking multi-modal structured conversion schema...`);
    
    // 3. Pass the binary document directly to our Gemini AI extraction service
    const structuredData = await parseResumeText(resumePart as any);
    console.log(`✅ [Gemini Core] Structural layout extraction verified successfully.`);

    // 4. Synthesize a clean profile string targeted specifically for vector optimization
    console.log(`⏳ [Vector Core] Synthesizing semantic profile summary string...`);
    const skillsString = Array.isArray(structuredData.skills) ? structuredData.skills.join(', ') : '';
    const rolesString = Array.isArray(structuredData.experience) 
      ? structuredData.experience.map((exp: any) => `${exp.role} at ${exp.company}`).join(', ') 
      : '';
    
    const embeddingInput = `
      Professional Summary: ${structuredData.summary || ''}. 
      Core Technical Skills: ${skillsString}. 
      Professional Roles and Experience: ${rolesString}.
    `.trim();

    // 5. Generate the 768-dimensional embedding vector array
    console.log(`⏳ [Gemini Embeddings] Generating mathematical vector array values...`);
    const vectorArray = await generateEmbedding(embeddingInput);
    
    // Transform the floating point array cleanly into an explicit pgvector string format: '[val1,val2,...]'
    const pgVectorString = `[${vectorArray.join(',')}]`;
    console.log(`✅ [Vector Core] Vector array compiled. Committing profile row to database.`);

        // 7. Commit the complete data model, including the vector string, to PostgreSQL
    const insertResult = await db.query(
      `INSERT INTO resumes (user_id, raw_text, structured_data, embedding) 
       VALUES ($1, $2, $3, $4::vector) 
       RETURNING id, created_at;`,
      [userId, embeddingInput, JSON.stringify(structuredData), pgVectorString]
    );

    // 🚀 FIXED PROPERTY LOOKUP: Target index 0 of the returned rows collection array
    const savedRow = insertResult.rows[0];

    return res.status(201).json({
      status: 'success',
      message: 'Resume processed, parsed, embedded, and recorded successfully.',
      data: {
        resumeId: savedRow.id,
        createdAt: savedRow.created_at,
        parsedProfile: structuredData
      }
    });

  } catch (error) {
    console.error('❌ [Resume Pipeline Failure]:', error);
    next(error);
  }
};
