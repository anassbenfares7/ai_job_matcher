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

// RESEND_API_KEY is required in production (verification emails must actually
// send). In development it is optional — the email service logs the link to the
// console instead of sending when the key is absent.
if (isProduction && !process.env.RESEND_API_KEY) {
  throw new Error(
    "❌ Missing critical environment variable: RESEND_API_KEY. " +
      "Email verification cannot send in production without it.",
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

  // --- Email verification ---
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  // The "From" address on verification emails. resend.dev works out of the box in
  // dev but only delivers to your own Resend account email; production needs a
  // verified domain.
  EMAIL_FROM: process.env.EMAIL_FROM || "AI Job Matcher <onboarding@resend.dev>",
  // Base URL the verification link points at (the frontend). Falls back to
  // FRONTEND_URL, then localhost.
  APP_URL:
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000",
};
