import { Router } from 'express';
import {
  approveUser,
  checkAdminAccess,
  deleteUser,
  listUsers,
  setUserSuspension
} from '../controllers/admin.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/access', requireAuth as any, requireAdmin as any, checkAdminAccess as any);
router.get('/users', requireAuth as any, requireAdmin as any, listUsers as any);
router.post('/users/:userId/approve', requireAuth as any, requireAdmin as any, approveUser as any);
router.patch('/users/:userId/suspension', requireAuth as any, requireAdmin as any, setUserSuspension as any);
router.delete('/users/:userId', requireAuth as any, requireAdmin as any, deleteUser as any);

export default router;
