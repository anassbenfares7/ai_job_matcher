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

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!error) {
    console.log(
      `📧 [Email] Sent "${email.subject}" to ${email.to} from "${env.EMAIL_FROM}" (id: ${data?.id ?? "unknown"})`,
    );
    return;
  }

  // Delivery failed — almost always an unverified sending domain or a
  // test-mode recipient restriction. Log it clearly either way.
  console.error(
    `📭 [Email] Resend rejected the send to ${email.to} from "${env.EMAIL_FROM}": ${error.message}`,
  );

  // In dev the console link is enough, so don't blow up. In prod, let the
  // caller decide (registration still succeeds; it just logs the failure).
  if (env.NODE_ENV === "production") {
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * Email the admin that a new user signed up and is waiting for approval.
 * `token` is the raw (unhashed) approval token.
 */
export const sendApprovalRequestEmail = async (
  adminEmail: string,
  opts: { userEmail: string; token: string; signedUpAt: Date },
): Promise<void> => {
  const link = `${env.APP_URL}/admin/review?token=${encodeURIComponent(opts.token)}`;
  const when = opts.signedUpAt.toISOString();

  // In dev, always surface the link in the server log so testing works even
  // when email delivery isn't set up.
  if (env.NODE_ENV !== "production") {
    console.log(
      `🔗 [Email:dev] Signup review link for ${opts.userEmail}:\n${link}`,
    );
  }

  if (!adminEmail) {
    console.error(
      "⚠️  [Email] ADMIN_EMAIL is not set — cannot send the signup review email.",
    );
    return;
  }

  // Kept plain and link-light on purpose — heavy HTML from a shared sending
  // domain gets spam-filtered.
  const text = [
    `New signup: ${opts.userEmail}`,
    `Signed up: ${when}`,
    "",
    `Approve or reject: ${link}`,
  ].join("\n");

  const html =
    `<p>New signup: <strong>${opts.userEmail}</strong><br>` +
    `Signed up: ${when}</p>` +
    `<p>Approve or reject: <a href="${link}">${link}</a></p>`;

  await deliver({
    to: adminEmail,
    subject: `New signup awaiting approval: ${opts.userEmail}`,
    html,
    text,
  });
};
