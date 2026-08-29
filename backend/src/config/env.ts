import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables
dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_ID',
  'JWT_SECRET'
];

// Validate that all required configuration items exist
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`❌ Missing critical environment variable: ${envVar}. Application cannot start.`);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL as string,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
};
