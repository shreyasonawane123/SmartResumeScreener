-- ============================================================
-- supabase/schema.sql
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- for your project. Run it once. Re-running is safe because of
-- the IF NOT EXISTS guards.
--
-- Setup steps:
-- 1. Create a free project at https://supabase.com
-- 2. Go to Settings > API to get your URL and keys
-- 3. Copy them into .env.local (see .env.example)
-- 4. Run this SQL in Dashboard > SQL Editor > New Query
-- ============================================================

-- Required for UUID primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- resumes
-- Stores both raw text and structured JSON from each uploaded resume.
-- Raw text is kept so extraction can be re-run without re-uploading.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename        TEXT NOT NULL,
  raw_text        TEXT NOT NULL,
  structured_json JSONB NOT NULL,           -- parsed ResumeData from LLM
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- job_descriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_descriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  description_text TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- scores
-- Stores the LLM's match score for each (resume, job_description) pair.
-- Cascade delete: removing a resume or JD cleans up its scores.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scores (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id          UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  score              NUMERIC(4, 2) NOT NULL,        -- 1.00–10.00
  justification      TEXT NOT NULL,
  matched_skills     TEXT[] NOT NULL DEFAULT '{}',
  missing_skills     TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the join query in lib/db/scores.ts
CREATE INDEX IF NOT EXISTS scores_job_description_id_idx ON scores (job_description_id);
CREATE INDEX IF NOT EXISTS scores_resume_id_idx ON scores (resume_id);
