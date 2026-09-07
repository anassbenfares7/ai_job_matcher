import dotenv from "dotenv";
import path from "path";

// Load environmental variables
dotenv.config();

const requiredEnvVars = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "JWT_SECRET",
];

// Validate that all required configuration items exist
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `❌ Missing critical environment variable: ${envVar}. Application cannot start.`,
    );
  }
}

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// RESEND_API_KEY + ADMIN_EMAIL drive the "new signup" review emails. Without
// them the server still runs — it just can't email the admin (in dev it logs
// the review link to the console instead) — so a missing value is a loud
// warning, not a startup crash.
if (isProduction && !process.env.RESEND_API_KEY) {
  console.error(
    "⚠️  RESEND_API_KEY is not set in production. Signup review emails will NOT be sent.",
  );
}
if (isProduction && !process.env.ADMIN_EMAIL) {
  console.error(
    "⚠️  ADMIN_EMAIL is not set in production. There is nowhere to send signup review emails.",
  );
}

export const env = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL as string,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  // Optional: only the job ingest script needs this, not the web server.
  JOOBLE_API_KEY: process.env.JOOBLE_API_KEY || "",

  // --- Signup approval emails ---
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  // The "From" address. onboarding@resend.dev works with no domain setup, but
  // only delivers to your own Resend account email — which is fine here because
  // review emails only ever go to ADMIN_EMAIL.
  EMAIL_FROM: process.env.EMAIL_FROM || "AI Job Matcher <onboarding@resend.dev>",
  // Where "new signup, please review" emails are sent. Set this to your own
  // address (ideally the one your Resend account uses).
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "",
  // Base URL the review link points at (the frontend). Falls back to
  // FRONTEND_URL, then localhost.
  APP_URL:
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000",
};
