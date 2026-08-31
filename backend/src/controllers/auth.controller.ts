import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { env } from '../config/env.js';

/**
 * Handle new user registration with strong password hashing
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  // 1. Inputs validation
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

  try {
    // 2. Check for duplicate accounts using parameterized SQL query
    const userCheck = await db.query('SELECT id FROM users WHERE email = $1;', [email.toLowerCase().trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Registration conflict. A user account with this email address already exists.'
      });
    }

    // 3. Securely hash the password string using 12 salt rounds
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Save the user account record to PostgreSQL
    const insertResult = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at;',
      [email.toLowerCase().trim(), passwordHash]
    );

    const newUser = insertResult.rows[0];

    // 5. Generate a stateless JWT access token for immediate session login
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      env.JWT_SECRET,
      { expiresIn: '7d' } // Secure 7-day token validation duration
    );

    return res.status(201).json({
      status: 'success',
      message: 'User account created successfully.',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.created_at
        }
      }
    });

  } catch (error) {
    next(error); // Forward unexpectedly caught database errors cleanly to our global error router
  }
};

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
      // Security Tip: Use ambiguous error messages to prevent email enumeration hacking techniques
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    const user = userQuery.rows[0];

    // 2. Prevent traditional login processing for Google OAuth-only accounts
    if (!user.password_hash) {
      return res.status(400).json({
        status: 'error',
        message: 'Authentication redirection required. This account was registered securely using Google Sign-In.'
      });
    }

    // 3. Compare the typed password string against our database cryptographic hash match parameters
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. Invalid email address or credentials.'
      });
    }

    // 4. Generate a new signed stateless token passport
    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      status: 'success',
      message: 'User logged in successfully.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Handle secure Google OAuth verify-and-upsert sign-in logic
 */
export const googleSignIn = async (req: Request, res: Response, next: NextFunction) => {
  const { idToken } = req.body;

  // 1. Structural body validation check
  if (!idToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid signature request. Missing Google idToken payload parameters.'
    });
  }

  try {
    // 2. Query Google's authentication keys directly to verify the token signature
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({
        status: 'error',
        message: 'Google token validation failed. Unable to extract profile metadata identifiers.'
      });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleId = payload.sub; // Google's unique, permanent user ID identifier string

    // 3. Look up or Upsert the user into our PostgreSQL instance safely
    // Check if user already exists by email
    let userQuery = await db.query('SELECT * FROM users WHERE email = $1;', [googleEmail]);
    let user;

    if (userQuery.rows.length === 0) {
      // Create a brand new user for OAuth sign-in
      const insertQuery = await db.query(
        'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id, email, created_at;',
        [googleEmail, googleId]
      );
      user = insertQuery.rows[0];
    } else {
      user = userQuery.rows[0];
      
      // If user signed up via email previously but is now linking Google, bind the google_id smoothly
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2;', [googleId, user.id]);
        user.google_id = googleId;
      }
    }

    // 4. Generate our internal signed application authorization token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Google Single Sign-In authentication successful.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('❌ Google OAuth Verification Routine Error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed. The provided Google access token is invalid or structurally corrupt.'
    });
  }
};
