-- ============================================================
-- supabase/schema.sql
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- for your project. Re-running is safe: all DDL uses
-- IF NOT EXISTS guards and idempotent ALTER TABLE logic.
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
-- job_descriptions
-- Must be created BEFORE resumes, because resumes now FK into this table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_descriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  description_text TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- resumes
-- Stores raw text and LLM-extracted structured JSON per upload.
-- job_description_id scopes each resume to the opening it was uploaded for.
-- Cascade delete: removing a job description removes its resumes too.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  filename           TEXT NOT NULL,
  raw_text           TEXT NOT NULL,
  structured_json    JSONB NOT NULL,           -- parsed ResumeData from LLM
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- MIGRATION NOTE (for projects that applied the old schema)
-- If the resumes table already exists WITHOUT job_description_id, run:
--
--   ALTER TABLE resumes
--     ADD COLUMN IF NOT EXISTS job_description_id UUID
--       REFERENCES job_descriptions(id) ON DELETE CASCADE;
--
-- Existing orphaned rows will have job_description_id = NULL. You may either:
--   a) Delete old rows:   DELETE FROM resumes WHERE job_description_id IS NULL;
--   b) Re-upload them under the correct job description.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- scores
-- LLM match score for each (resume, job_description) pair.
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

-- Indexes
CREATE INDEX IF NOT EXISTS resumes_job_description_id_idx ON resumes (job_description_id);
CREATE INDEX IF NOT EXISTS scores_job_description_id_idx  ON scores (job_description_id);
CREATE INDEX IF NOT EXISTS scores_resume_id_idx           ON scores (resume_id);
