import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../config/database.js';
import { env } from '../config/env.js';
import { sendApprovalRequestEmail } from '../services/email.service.js';
import {
  createApprovalToken,
  hashToken,
  canResendApprovalRequest,
} from '../utils/tokens.js';

// --- Shared helpers ---------------------------------------------------------

const signSessionToken = (user: { id: string; email: string }): string =>
  jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });

const toPublicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  createdAt: user.created_at,
});

// Same wording whether or not the email is already registered — stops attackers
// enumerating which addresses have accounts.
const SIGNUP_GENERIC = {
  status: 'success' as const,
  message:
    'Account created. An admin will review it shortly — you can sign in once it is approved.',
};

/**
 * Give a pending user a fresh approval token and email the admin a review link.
 * Never throws — a mail failure is logged, not surfaced to the registrant.
 */
const requestApproval = async (userId: string, userEmail: string): Promise<void> => {
  const { token, tokenHash } = createApprovalToken();
  await db.query(
    'UPDATE users SET approval_token_hash = $1, approval_requested_at = NOW() WHERE id = $2;',
    [tokenHash, userId],
  );
  try {
    await sendApprovalRequestEmail(env.ADMIN_EMAIL, {
      userEmail,
      token,
      signedUpAt: new Date(),
    });
  } catch (mailError) {
    console.error('❌ [Approval] Review email failed to send:', mailError);
  }
};

// --- Registration --------------------------------------------------------

/**
 * Register a new user. Creates the account in a pending state, emails the admin
 * a review link, and returns NO session token.
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password || !email.includes('@')) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid payload. Please provide a valid email address and password.'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Security requirement unfulfilled. Password must be at least 6 characters long.'
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await db.query(
      'SELECT id, is_approved, approval_requested_at FROM users WHERE email = $1;',
      [normalizedEmail],
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // Still pending — re-notify the admin if the cooldown has passed. Respond
      // with the generic message either way.
      if (!user.is_approved && canResendApprovalRequest(user.approval_requested_at)) {
        await requestApproval(user.id, normalizedEmail);
      }
      return res.status(201).json(SIGNUP_GENERIC);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id;',
      [normalizedEmail, passwordHash],
    );

    await requestApproval(inserted.rows[0].id, normalizedEmail);

    return res.status(201).json(SIGNUP_GENERIC);

  } catch (error) {
    next(error);
  }
};

// --- Admin review / approve / reject ------------------------------------

/**
 * Read-only: look up the pending signup behind a review token so the admin page
 * can show who it is. Safe for link prefetching.
 */
export const reviewSignup = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.query.token || req.body?.token) as string | undefined;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Review token is missing.' });
  }

  try {
    const result = await db.query(
      `SELECT email, is_approved, approval_requested_at, created_at
         FROM users
        WHERE approval_token_hash = $1;`,
      [hashToken(token)],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'This review link is invalid or has already been used.'
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      status: 'success',
      data: {
        email: row.email,
        signedUpAt: row.approval_requested_at || row.created_at,
        alreadyApproved: row.is_approved,
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Approve the pending signup behind a review token. Idempotent-ish: a used token
 * is gone, so a second click returns "invalid or already used".
 */
export const approveSignup = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Approval token is missing.' });
  }

  try {
    const result = await db.query(
      `UPDATE users
          SET is_approved = TRUE,
              approval_token_hash = NULL,
              approval_requested_at = NULL,
              updated_at = NOW()
        WHERE approval_token_hash = $1
      RETURNING email;`,
      [hashToken(token)],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'This review link is invalid or has already been used.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Approved ${result.rows[0].email}. They can now sign in.`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Reject the pending signup behind a review token — deletes the account so the
 * email address is free again. Won't touch an already-approved account.
 */
export const rejectSignup = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Review token is missing.' });
  }

  try {
    const result = await db.query(
      `DELETE FROM users
        WHERE approval_token_hash = $1 AND is_approved = FALSE
      RETURNING email;`,
      [hashToken(token)],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'This review link is invalid or has already been used.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Rejected and removed ${result.rows[0].email}.`
    });

  } catch (error) {
    next(error);
  }
};

// --- Login --------------------------------------------------------------

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid payload. Missing authentication credentials.'
    });
  }

  try {
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1;', [email.toLowerCase().trim()]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    const user = userQuery.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        status: 'error',
        message: 'Authentication redirection required. This account was registered securely using Google Sign-In.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    if (!user.is_approved) {
      return res.status(403).json({
        status: 'error',
        code: 'PENDING_APPROVAL',
        message: 'Your account is awaiting admin approval. Please check back later.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'User logged in successfully.',
      data: { token: signSessionToken(user), user: toPublicUser(user) }
    });

  } catch (error) {
    next(error);
  }
};

// --- Google sign-in ----------------------------------------------------

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const googleSignIn = async (req: Request, res: Response, next: NextFunction) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid signature request. Missing Google idToken payload parameters.'
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        status: 'error',
        message: 'Google token validation failed. The Google account email is missing or unverified.'
      });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleId = payload.sub;

    let userQuery = await db.query('SELECT * FROM users WHERE email = $1;', [googleEmail]);
    let user;

    if (userQuery.rows.length === 0) {
      const insertQuery = await db.query(
        `INSERT INTO users (email, google_id) VALUES ($1, $2)
         RETURNING id, email, is_approved, created_at;`,
        [googleEmail, googleId]
      );
      user = insertQuery.rows[0];
    } else {
      user = userQuery.rows[0];
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2;', [googleId, user.id]);
        user.google_id = googleId;
      }
    }

    // Google sign-ups still need admin approval.
    if (!user.is_approved) {
      if (canResendApprovalRequest(user.approval_requested_at)) {
        await requestApproval(user.id, user.email);
      }
      return res.status(403).json({
        status: 'error',
        code: 'PENDING_APPROVAL',
        message: 'Your account is awaiting admin approval. Please check back later.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Google Single Sign-In authentication successful.',
      data: { token: signSessionToken(user), user: toPublicUser(user) }
    });

  } catch (error) {
    console.error('❌ Google OAuth Verification Routine Error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed. The provided Google access token is invalid or structurally corrupt.'
    });
  }
};
