import crypto from "crypto";

/**
 * Signup-approval token handling.
 *
 * The raw token goes into the admin's review email and is never stored. Only its
 * SHA-256 hash lands in the database, so a leaked DB dump can't be used to
 * approve accounts.
 */

// Minimum gap between re-sending the "please review" email for one account
// (e.g. if the same person registers again while still pending).
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Create a fresh approval token pair.
 * - `token`     → goes in the review link emailed to the admin
 * - `tokenHash` → stored in users.approval_token_hash
 */
export const createApprovalToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  return { token, tokenHash: hashToken(token) };
};

/**
 * True when another review email may be sent for an account whose last one went
 * out at `requestedAt`.
 */
export const canResendApprovalRequest = (
  requestedAt: Date | string | null | undefined,
): boolean => {
  if (!requestedAt) return true;
  const sentMs = new Date(requestedAt).getTime();
  if (Number.isNaN(sentMs)) return true;
  return Date.now() - sentMs > RESEND_COOLDOWN_MS;
};
