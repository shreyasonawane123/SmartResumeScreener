// ============================================================
// lib/db/resumes.ts
//
// CRUD operations for the `resumes` table.
// Resumes are scoped to the job description they were uploaded
// for — use getResumesByJobDescription(id) for all scoring
// queries; getAllResumes() is intentionally removed to prevent
// cross-job contamination.
// ============================================================

import { getSupabaseClient } from "./client";
import type { ResumeData, StoredResume } from "@/lib/types";

export class DbError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DbError";
  }
}

/**
 * Insert a new resume record, scoped to a specific job description.
 * Every upload must be tied to an opening — orphaned resumes are not allowed.
 */
export async function insertResume(params: {
  job_description_id: string;
  filename: string;
  raw_text: string;
  structured_json: ResumeData;
}): Promise<StoredResume> {
  const db = getSupabaseClient();

  // Check if a resume with the same filename for this job description already exists
  const { data: existing, error: findError } = await db
    .from("resumes")
    .select("id")
    .eq("job_description_id", params.job_description_id)
    .eq("filename", params.filename)
    .maybeSingle();

  if (findError) {
    throw new DbError(`Failed to check existing resume: ${findError.message}`, findError);
  }

  if (existing) {
    // Overwrite the existing resume
    const { data, error } = await db
      .from("resumes")
      .update({
        raw_text: params.raw_text,
        structured_json: params.structured_json,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new DbError(`Failed to update existing resume: ${error.message}`, error);
    }
    return data as StoredResume;
  }

  // Otherwise, insert new
  const { data, error } = await db
    .from("resumes")
    .insert({
      job_description_id: params.job_description_id,
      filename: params.filename,
      raw_text: params.raw_text,
      structured_json: params.structured_json,
    })
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to insert resume: ${error.message}`, error);
  }

  return data as StoredResume;
}

/**
 * Fetch all resumes that belong to a specific job description.
 * This is the primary query used by the scoring pipeline —
 * only resumes uploaded for the active job are scored.
 */
export async function getResumesByJobDescription(
  jobDescriptionId: string,
): Promise<StoredResume[]> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("resumes")
    .select("*")
    .eq("job_description_id", jobDescriptionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DbError(
      `Failed to fetch resumes for job ${jobDescriptionId}: ${error.message}`,
      error,
    );
  }

  return (data ?? []) as StoredResume[];
}

/** Fetch a single resume by ID. */
export async function getResumeById(id: string): Promise<StoredResume | null> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("resumes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new DbError(`Failed to fetch resume ${id}: ${error.message}`, error);
  }

  return data as StoredResume;
}

/** Delete a resume and its associated scores (cascade handles scores). */
export async function deleteResume(id: string): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db.from("resumes").delete().eq("id", id);

  if (error) {
    throw new DbError(`Failed to delete resume ${id}: ${error.message}`, error);
  }
}
