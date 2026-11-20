import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../config/database.js';

// Extend the Express Request type declaration to cleanly include the authenticated user context
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof payload === 'string' ||
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. The provided authentication token is invalid or expired.'
      });
    }
    userId = payload.id;
  } catch (error) {
    console.error('❌ JWT Verification Error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. The provided authentication token is invalid or expired.'
    });
  }

  try {
    const accountResult = await db.query(
      'SELECT email, is_approved, is_suspended FROM users WHERE id = $1;',
      [userId]
    );
    const account = accountResult.rows[0];

    if (!account || !account.is_approved || account.is_suspended) {
      return res.status(403).json({
        status: 'error',
        message: 'This account is no longer active. Please contact the administrator.'
      });
    }

    req.user = {
      id: userId,
      email: account.email
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const adminEmail = env.ADMIN_EMAIL.trim().toLowerCase();
  const userEmail = req.user?.email.trim().toLowerCase();

  if (!adminEmail) {
    return res.status(503).json({
      status: 'error',
      message: 'Admin access is not configured on the server.'
    });
  }

  if (!userEmail || userEmail !== adminEmail) {
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to access this page.'
    });
  }

  next();
};