-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token_hash CHAR(64),          -- SHA-256 hex of the emailed token; raw token is never stored
    email_verification_sent_at TIMESTAMPTZ,          -- when the last verification email went out (drives expiry + resend cooldown)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Columns added after the users table already existed in deployed databases.
-- Safe to run repeatedly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash CHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

-- Accounts that predate email verification are grandfathered in so this change
-- does not lock existing users out. Fixed cutoff (not NOW()) so re-running this
-- file never auto-verifies users who registered after the feature shipped.
UPDATE users
   SET email_verified = TRUE
 WHERE email_verified = FALSE
   AND created_at < TIMESTAMPTZ '2026-09-07 00:00:00+00';

-- Fast lookup when a user clicks the verification link.
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
    ON users(email_verification_token_hash);

-- 2. Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Job Postings Table
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE,   -- provider's own job id (Jooble); used to skip duplicates on re-ingest
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    apply_url TEXT,                    -- link where the candidate actually applies
    source VARCHAR(255),              -- origin site the listing came from (linkedin.com, rekrute.com, ...)
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Columns added after the table already existed in deployed databases.
-- Safe to run repeatedly; no-ops if the column is already there.
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS apply_url   TEXT;
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS source      VARCHAR(255);

-- 4. Applications & Matches Table
CREATE TABLE IF NOT EXISTS applications_and_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    match_score DECIMAL(5, 4) NOT NULL,
    generated_cover_letter TEXT,
    generated_feedback TEXT,
    is_saved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_job UNIQUE (user_id, job_posting_id)
);

-- Create performance indexes for relational constraints
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON applications_and_matches(user_id);
