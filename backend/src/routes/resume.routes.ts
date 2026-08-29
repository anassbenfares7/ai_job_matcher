import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';
import { uploadAndParseResume } from '../controllers/resume.controller.js';

const router = Router();

// Secure route: Requires full auth session checks + handling single multipart field named "resume"
router.post('/upload', requireAuth as any, uploadResume.single('resume'), uploadAndParseResume as any);

export default router;
