import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../config/database.js';
import { env } from '../config/env.js';
import { sendVerificationEmail } from '../services/email.service.js';
import {
  createEmailVerificationToken,
  hashToken,
  isVerificationExpired,
  canResendVerification,
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
const REGISTER_GENERIC = {
  status: 'success' as const,
  message:
    'Account created. Check your email for a verification link to activate it.',
};

// --- Registration ---------------------------------------------------------

/**
 * Register a new user. Creates the account in an unverified state, emails a
 * verification link, and returns NO session token — the user must verify first.
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  // 1. Input validation
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
    // 2. Look for an existing account (parameterized query)
    const existing = await db.query(
      'SELECT id, email_verified, email_verification_sent_at FROM users WHERE email = $1;',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];

      // Account exists but was never verified — quietly resend the link if the
      // cooldown has passed. Either way, respond with the generic message.
      if (!user.email_verified && canResendVerification(user.email_verification_sent_at)) {
        const { token, tokenHash } = createEmailVerificationToken();
        await db.query(
          'UPDATE users SET email_verification_token_hash = $1, email_verification_sent_at = NOW() WHERE id = $2;',
          [tokenHash, user.id]
        );
        try {
          await sendVerificationEmail(normalizedEmail, token);
        } catch (mailError) {
          console.error('❌ [Register] Verification email resend failed:', mailError);
        }
      }

      return res.status(201).json(REGISTER_GENERIC);
    }

    // 3. Hash the password (12 salt rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Create the unverified account with a verification token
    const { token, tokenHash } = createEmailVerificationToken();
    await db.query(
      `INSERT INTO users (email, password_hash, email_verification_token_hash, email_verification_sent_at)
       VALUES ($1, $2, $3, NOW());`,
      [normalizedEmail, passwordHash, tokenHash]
    );

    // 5. Send the verification email. A delivery failure does not roll back the
    // account — the user can trigger "resend" — but it is logged.
    try {
      await sendVerificationEmail(normalizedEmail, token);
    } catch (mailError) {
      console.error('❌ [Register] Verification email failed to send:', mailError);
    }

    return res.status(201).json(REGISTER_GENERIC);

  } catch (error) {
    next(error);
  }
};

// --- Email verification ---------------------------------------------------

/**
 * Confirm an emailed verification token. On success the account is marked
 * verified and a session token is returned so the click logs the user straight in.
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Verification token is missing or malformed.'
    });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await db.query(
      `SELECT id, email, email_verified, email_verification_sent_at, created_at
         FROM users
        WHERE email_verification_token_hash = $1;`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'This verification link is invalid or has already been used.'
      });
    }

    const user = result.rows[0];

    // Already verified (link clicked twice) — still hand back a session token.
    if (user.email_verified) {
      return res.status(200).json({
        status: 'success',
        message: 'Email address already verified.',
        data: { token: signSessionToken(user), user: toPublicUser(user) }
      });
    }

    if (isVerificationExpired(user.email_verification_sent_at)) {
      return res.status(400).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'This verification link has expired. Please request a new one.'
      });
    }

    await db.query(
      `UPDATE users
          SET email_verified = TRUE,
              email_verification_token_hash = NULL,
              email_verification_sent_at = NULL,
              updated_at = NOW()
        WHERE id = $1;`,
      [user.id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Email verified successfully.',
      data: { token: signSessionToken(user), user: toPublicUser(user) }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Resend the verification email. Always responds with the same generic message
 * (no account enumeration) and honours a per-account cooldown.
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  const generic = {
    status: 'success' as const,
    message: 'If that account exists and still needs verification, a new link is on its way.'
  };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(200).json(generic);
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db.query(
      'SELECT id, email_verified, email_verification_sent_at FROM users WHERE email = $1;',
      [normalizedEmail]
    );

    if (result.rows.length === 0) return res.status(200).json(generic);

    const user = result.rows[0];
    if (user.email_verified) return res.status(200).json(generic);
    if (!canResendVerification(user.email_verification_sent_at)) {
      return res.status(200).json(generic);
    }

    const { token, tokenHash } = createEmailVerificationToken();
    await db.query(
      'UPDATE users SET email_verification_token_hash = $1, email_verification_sent_at = NOW() WHERE id = $2;',
      [tokenHash, user.id]
    );

    try {
      await sendVerificationEmail(normalizedEmail, token);
    } catch (mailError) {
      console.error('❌ [ResendVerification] Email failed to send:', mailError);
    }

    return res.status(200).json(generic);

  } catch (error) {
    next(error);
  }
};

// --- Login --------------------------------------------------------------

/**
 * Handle user session login and password hash comparison
 */
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid payload. Missing authentication credentials.'
    });
  }

  try {
    // 1. Look up the targeted user identity
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1;', [email.toLowerCase().trim()]);
    if (userQuery.rows.length === 0) {
      // Ambiguous error message to prevent email enumeration
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    const user = userQuery.rows[0];

    // 2. Block traditional login for Google OAuth-only accounts
    if (!user.password_hash) {
      return res.status(400).json({
        status: 'error',
        message: 'Authentication redirection required. This account was registered securely using Google Sign-In.'
      });
    }

    // 3. Compare the supplied password against the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    // 4. Block unverified accounts (password was correct, so revealing this is an
    // accepted trade-off).
    if (!user.email_verified) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before signing in. Check your inbox for the verification link.'
      });
    }

    // 5. Issue a signed session token
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

/**
 * Handle secure Google OAuth verify-and-upsert sign-in logic
 */
export const googleSignIn = async (req: Request, res: Response, next: NextFunction) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid signature request. Missing Google idToken payload parameters.'
    });
  }

  try {
    // 1. Verify the token signature against Google's keys
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // 2. Require a verified Google email — we treat Google as the proof of
    // ownership, so an unverified one is not good enough.
    if (!payload || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        status: 'error',
        message: 'Google token validation failed. The Google account email is missing or unverified.'
      });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleId = payload.sub;

    // 3. Look up or create the user. Google accounts are verified on creation.
    let userQuery = await db.query('SELECT * FROM users WHERE email = $1;', [googleEmail]);
    let user;

    if (userQuery.rows.length === 0) {
      const insertQuery = await db.query(
        `INSERT INTO users (email, google_id, email_verified)
         VALUES ($1, $2, TRUE)
         RETURNING id, email, created_at;`,
        [googleEmail, googleId]
      );
      user = insertQuery.rows[0];
    } else {
      user = userQuery.rows[0];

      // Link Google to a pre-existing email account, and mark it verified since
      // Google has now proven control of the address.
      if (!user.google_id || !user.email_verified) {
        await db.query(
          'UPDATE users SET google_id = COALESCE(google_id, $1), email_verified = TRUE WHERE id = $2;',
          [googleId, user.id]
        );
        user.google_id = user.google_id || googleId;
        user.email_verified = true;
      }
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
