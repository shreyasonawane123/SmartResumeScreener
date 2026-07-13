// ============================================================
// lib/constants.ts
//
// App-wide configuration constants.
// Putting the shortlist threshold here means it's a single line
// to point to during an interview — not buried in business logic.
// ============================================================

/**
 * Candidates with score >= this value appear in the "Shortlisted" section.
 * Score scale is 1–10. Default of 7 matches the "strong candidate" bar
 * most recruiting rubrics use.
 */
export const DEFAULT_SHORTLIST_THRESHOLD = 7;

/** Maximum number of files that can be uploaded in one session. */
export const MAX_RESUME_UPLOADS = 20;

/** Maximum file size for uploaded resumes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Accepted MIME types for resume uploads. */
export const ACCEPTED_FILE_TYPES = ["application/pdf", "text/plain"];

/** Max retries for a failed LLM call before surfacing an error to the user. */
export const LLM_MAX_RETRIES = 1;
