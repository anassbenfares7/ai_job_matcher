import { Router } from 'express';
import { registerUser, loginUser, googleSignIn } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleSignIn); // Route mounted for frontend incoming token validation

export default router;
