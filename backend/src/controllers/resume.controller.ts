import { Response, NextFunction } from 'express';
import { createRequire } from 'module';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { parseResumeText } from '../services/ai.service.js';
import { db } from '../config/database.js';

// Dynamically create a standard require loader to import CommonJS smoothly
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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

    console.log(`⏳ [Resume Engine] Staging raw buffer parsing for user: ${userId}`);

    // 2. Extract raw text content out of the incoming file buffer memory pool
    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text ? pdfData.text.trim() : '';

    // 3. Implements the text validation check fallback strategy
    if (rawText.length < 50) {
      return res.status(400).json({
        status: 'error',
        message: 'Parsing aborted. The uploaded PDF contains insufficient extractable text. Please ensure it is not a flat scanned image file.'
      });
    }

    console.log(`⏳ [Gemini Core] Invoking structured JSON conversion schema...`);

    // 4. Pass the validated raw text to our Gemini AI extraction service
    const structuredData = await parseResumeText(rawText);

    console.log(`✅ [Gemini Core] Structural layout extraction verified successfully.`);

    // 5. Commit the record directly to PostgreSQL (Leaving the vector embedding column null for the next step)
    const insertResult = await db.query(
      `INSERT INTO resumes (user_id, raw_text, structured_data) 
       VALUES ($1, $2, $3) 
       RETURNING id, created_at;`,
      [userId, rawText, JSON.stringify(structuredData)]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Resume processed, parsed, and recorded successfully.',
      data: {
        resumeId: insertResult.rows[0].id,
        createdAt: insertResult.rows[0].created_at,
        parsedProfile: structuredData
      }
    });

  } catch (error) {
    console.error('❌ [Resume Pipeline Failure]:', error);
    next(error);
  }
};
