import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSemanticMatches } from '../controllers/match.controller.js';

const router = Router();

// Secure matching query route
router.get('/', requireAuth as any, getSemanticMatches as any);

export default router;
