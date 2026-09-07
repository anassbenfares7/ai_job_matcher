import { Resend } from "resend";
import { env } from "../config/env.js";

/**
 * All outbound email goes through this file. Swapping providers later means
 * changing only `deliver()` — the rest of the app calls the named helpers below.
 */

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const deliver = async (email: OutboundEmail): Promise<void> => {
  // No key configured (local dev): log instead of sending so the flow still works.
  if (!resend) {
    console.log(
      `📧 [Email:dev] Would send "${email.subject}" to ${email.to}\n${email.text}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (error) {
    // In dev, a delivery failure is usually just an unverified sending domain.
    // Don't blow up with a stack trace — the console link above is enough.
    if (env.NODE_ENV !== "production") {
      console.warn(
        `📭 [Email:dev] Resend did not deliver to ${email.to}: ${error.message}`,
      );
      return;
    }
    // Surface as a normal error; callers decide whether to fail the request.
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * Send the "confirm your email" message. `token` is the raw (unhashed) token.
 */
export const sendVerificationEmail = async (
  to: string,
  token: string,
): Promise<void> => {
  const link = `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;

  // Outside production, always surface the link in the server log so local
  // testing works even when email delivery is misconfigured or unavailable.
  if (env.NODE_ENV !== "production") {
    console.log(`🔗 [Email:dev] Verification link for ${to}:\n${link}`);
  }

  const text = [
    "Welcome to AI Job Matcher.",
    "",
    "Confirm your email address to activate your account:",
    link,
    "",
    "This link expires in 24 hours. If you didn't create an account, ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="font-size: 18px; margin-bottom: 8px;">Confirm your email</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #444;">
        Welcome to AI Job Matcher. Click below to activate your account.
      </p>
      <p style="margin: 24px 0;">
        <a href="${link}"
           style="background: #1a1a1a; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 9999px; display: inline-block;">
          Verify email address
        </a>
      </p>
      <p style="font-size: 12px; color: #888; line-height: 1.6;">
        This link expires in 24 hours. If you didn't create an account, you can ignore this email.
      </p>
      <p style="font-size: 12px; color: #aaa; word-break: break-all;">${link}</p>
    </div>
  `.trim();

  await deliver({
    to,
    subject: "Confirm your email — AI Job Matcher",
    html,
    text,
  });
};
