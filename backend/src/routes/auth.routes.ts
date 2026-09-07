import { Router } from 'express';
import {
  registerUser,
  loginUser,
  googleSignIn,
  reviewSignup,
  approveSignup,
  rejectSignup,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleSignIn);

// Admin signup review (the token from the review email is the authorization).
router.get('/review', reviewSignup);
router.post('/approve', approveSignup);
router.post('/reject', rejectSignup);

export default router;
