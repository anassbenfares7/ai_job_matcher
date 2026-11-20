import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/database.js';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getUserId = (req: Request, res: Response): string | null => {
  const { userId } = req.params;
  if (typeof userId !== 'string' || !isUuid(userId)) {
    res.status(400).json({ status: 'error', message: 'A valid user ID is required.' });
    return null;
  }
  return userId;
};

export const checkAdminAccess = (_req: Request, res: Response) =>
  res.status(200).json({ status: 'success', data: { isAdmin: true } });

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  const search = typeof req.query.search === 'string'
    ? req.query.search.trim().slice(0, 100)
    : '';
  const requestedPage = Number(req.query.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 20;
  const searchPattern = search ? `%${search}%` : null;

  try {
    const [countResult, usersResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM users
          WHERE $1::text IS NULL OR email ILIKE $1;`,
        [searchPattern]
      ),
      db.query(
        `SELECT u.id, u.email, u.is_approved, u.is_suspended, u.created_at,
                r.id AS resume_id, r.created_at AS resume_created_at,
                r.structured_data AS resume_profile
           FROM users u
           LEFT JOIN LATERAL (
             SELECT id, created_at, structured_data
               FROM resumes
              WHERE user_id = u.id
              ORDER BY created_at DESC
              LIMIT 1
           ) r ON TRUE
          WHERE $1::text IS NULL OR u.email ILIKE $1
          ORDER BY u.created_at DESC
          LIMIT $2 OFFSET $3;`,
        [searchPattern, pageSize, (page - 1) * pageSize]
      )
    ]);

    const users = usersResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      isApproved: row.is_approved,
      isSuspended: row.is_suspended,
      createdAt: row.created_at,
      resume: row.resume_id
        ? {
            id: row.resume_id,
            createdAt: row.resume_created_at,
            profile: row.resume_profile
          }
        : null
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        users,
        page,
        pageSize,
        total: countResult.rows[0].total
      }
    });
  } catch (error) {
    next(error);
  }
};

export const approveUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  if (userId === req.user?.id) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot change your own account approval.'
    });
  }

  try {
    const result = await db.query(
      `UPDATE users
          SET is_approved = TRUE,
              approval_token_hash = NULL,
              approval_requested_at = NULL,
              updated_at = NOW()
        WHERE id = $1 AND is_suspended = FALSE
      RETURNING id, email, is_approved, is_suspended;`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found or account is suspended.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        isApproved: result.rows[0].is_approved,
        isSuspended: result.rows[0].is_suspended
      }
    });
  } catch (error) {
    next(error);
  }
};

export const setUserSuspension = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  if (typeof req.body?.suspended !== 'boolean') {
    return res.status(400).json({
      status: 'error',
      message: 'Choose whether this account should be suspended.'
    });
  }

  if (userId === req.user?.id) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot suspend your own account.'
    });
  }

  try {
    const result = await db.query(
      `UPDATE users
          SET is_suspended = $1, updated_at = NOW()
        WHERE id = $2
      RETURNING id, email, is_approved, is_suspended;`,
      [req.body.suspended, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        isApproved: result.rows[0].is_approved,
        isSuspended: result.rows[0].is_suspended
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  if (userId === req.user?.id) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot delete your own account.'
    });
  }

  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email;',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: { id: result.rows[0].id, email: result.rows[0].email }
    });
  } catch (error) {
    next(error);
  }
};
