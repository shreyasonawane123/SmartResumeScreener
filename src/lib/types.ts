// ============================================================
// lib/types.ts
//
// Single source of truth for every data shape that crosses a
// module boundary in this app. Import from here; never inline
// duplicate type definitions in route handlers or components.
// ============================================================

// ---------------------------------------------------------------------------
// Resume / Extraction types
// ---------------------------------------------------------------------------

/** One entry in the candidate's work history. */
export interface Experience {
  role: string;
  company: string;
  /** Duration in years, e.g. 2.5. Use 0 if unknown. */
  years: number;
}

/** One educational credential. */
export interface Education {
  degree: string;
  institution: string;
}

/**
 * Structured resume data extracted by the LLM.
 * This is what goes into the `structured_json` column in Supabase.
 */
export interface ResumeData {
  /** Candidate's full name as it appears on the resume. */
  name: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
}

/** Row shape as returned from the `resumes` Supabase table. */
export interface StoredResume {
  id: string;
  filename: string;
  raw_text: string;
  structured_json: ResumeData;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Job Description types
// ---------------------------------------------------------------------------

export interface JobDescription {
  title: string;
  description_text: string;
}

/** Row shape as returned from the `job_descriptions` Supabase table. */
export interface StoredJobDescription extends JobDescription {
  id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Scoring types
// ---------------------------------------------------------------------------

/**
 * Output of the scoring LLM call.
 * Score is 1–10 (integer or one decimal place).
 */
export interface ScoreResult {
  score: number;
  justification: string;
  matched_skills: string[];
  missing_skills: string[];
}

/**
 * A scored candidate — combines the stored resume with its score result.
 * This is what the frontend renders per card.
 */
export interface CandidateScore {
  resume: StoredResume;
  score_result: ScoreResult;
  score_id: string;
  job_description_id: string;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------------------------------------------------------------------------
// Processing state (for the upload progress UI)
// ---------------------------------------------------------------------------

export type ProcessingStep = "idle" | "parsing" | "extracting" | "scoring" | "done" | "error";

export interface ProcessingState {
  step: ProcessingStep;
  filename?: string;
  error?: string;
}
