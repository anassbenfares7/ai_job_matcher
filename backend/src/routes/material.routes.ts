import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOrGenerateMaterials } from '../controllers/material.controller.js';

const router = Router();

router.post('/generate', requireAuth as any, getOrGenerateMaterials as any);

export default router;
