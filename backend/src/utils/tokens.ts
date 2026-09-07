import crypto from "crypto";

/**
 * Email-verification token handling.
 *
 * The raw token is emailed to the user and never stored. Only its SHA-256 hash
 * lands in the database, so a leaked DB dump cannot be used to verify accounts.
 */

// How long a verification link stays valid after it is sent.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Minimum gap between "resend verification email" requests for one account.
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Create a fresh verification token pair.
 * - `token`     → goes in the emailed link
 * - `tokenHash` → stored in users.email_verification_token_hash
 */
export const createEmailVerificationToken = (): {
  token: string;
  tokenHash: string;
} => {
  const token = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  return { token, tokenHash: hashToken(token) };
};

/**
 * True when a verification email sent at `sentAt` has expired.
 * A missing timestamp counts as expired.
 */
export const isVerificationExpired = (
  sentAt: Date | string | null | undefined,
): boolean => {
  if (!sentAt) return true;
  const sentMs = new Date(sentAt).getTime();
  if (Number.isNaN(sentMs)) return true;
  return Date.now() - sentMs > EMAIL_VERIFICATION_TTL_MS;
};

/**
 * True when another verification email may be sent for an account whose last
 * email went out at `sentAt`.
 */
export const canResendVerification = (
  sentAt: Date | string | null | undefined,
): boolean => {
  if (!sentAt) return true;
  const sentMs = new Date(sentAt).getTime();
  if (Number.isNaN(sentMs)) return true;
  return Date.now() - sentMs > RESEND_COOLDOWN_MS;
};
