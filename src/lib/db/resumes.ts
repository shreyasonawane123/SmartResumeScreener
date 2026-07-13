// ============================================================
// lib/db/resumes.ts
//
// CRUD operations for the `resumes` table.
// All functions throw descriptive errors on DB failure —
// callers (API routes) are responsible for catching and
// returning appropriate HTTP responses.
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
 * Insert a new resume record into the database.
 * Stores both raw text (for auditing) and structured JSON (for scoring).
 */
export async function insertResume(params: {
  filename: string;
  raw_text: string;
  structured_json: ResumeData;
}): Promise<StoredResume> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("resumes")
    .insert({
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

/** Fetch all stored resumes, newest first. */
export async function getAllResumes(): Promise<StoredResume[]> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("resumes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new DbError(`Failed to fetch resumes: ${error.message}`, error);
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
