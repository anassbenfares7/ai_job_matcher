-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,      -- an admin must approve the account before the user can log in
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    approval_token_hash CHAR(64),                    -- SHA-256 hex of the token in the admin's review email; raw token is never stored
    approval_requested_at TIMESTAMPTZ,               -- when the signup happened / last admin email was sent (drives the resend cooldown)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- These columns first shipped under email-verification names. Rename them in
-- place on databases that already have them (no data is lost).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
    ALTER TABLE users RENAME COLUMN email_verified TO is_approved;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verification_token_hash') THEN
    ALTER TABLE users RENAME COLUMN email_verification_token_hash TO approval_token_hash;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verification_sent_at') THEN
    ALTER TABLE users RENAME COLUMN email_verification_sent_at TO approval_requested_at;
  END IF;
END $$;

-- For brand-new databases built straight from this file, or any missing a column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_token_hash CHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;

-- Accounts that predate admin approval keep their access. Fixed cutoff (not
-- NOW()) so re-running this file never auto-approves later signups.
UPDATE users
   SET is_approved = TRUE
 WHERE is_approved = FALSE
   AND created_at < TIMESTAMPTZ '2026-09-07 00:00:00+00';

DROP INDEX IF EXISTS idx_users_email_verification_token_hash;

-- Fast lookup when the admin opens a review link.
CREATE INDEX IF NOT EXISTS idx_users_approval_token_hash
    ON users(approval_token_hash);

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
