import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Extend the Express Request type declaration to cleanly include the authenticated user context
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // 1. Extract the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed. Missing or malformed token access header.'
    });
  }

  // 2. Extract the raw token from the "Bearer <token>" string format
  const token = authHeader.split(' ')[1];

  try {
    // 3. Verify the token signature against our application secret
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
    
    // 4. Attach the user identity payload directly onto the Request context
    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    // 5. Pass control safely to the next controller in line
    next();
  } catch (error) {
    console.error('❌ JWT Verification Error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. The provided authentication token is invalid or expired.'
    });
  }
};