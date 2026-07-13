// ============================================================
// lib/db/jobDescriptions.ts
// ============================================================

import { getSupabaseClient } from "./client";
import type { JobDescription, StoredJobDescription } from "@/lib/types";
import { DbError } from "./resumes";

/** Save a new job description and return the stored record. */
export async function insertJobDescription(
  params: JobDescription,
): Promise<StoredJobDescription> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("job_descriptions")
    .insert({
      title: params.title,
      description_text: params.description_text,
    })
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to save job description: ${error.message}`, error);
  }

  return data as StoredJobDescription;
}

/** Fetch all saved job descriptions, newest first. */
export async function getAllJobDescriptions(): Promise<StoredJobDescription[]> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("job_descriptions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new DbError(`Failed to fetch job descriptions: ${error.message}`, error);
  }

  return (data ?? []) as StoredJobDescription[];
}

/** Fetch a single job description by ID. */
export async function getJobDescriptionById(
  id: string,
): Promise<StoredJobDescription | null> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("job_descriptions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new DbError(
      `Failed to fetch job description ${id}: ${error.message}`,
      error,
    );
  }

  return data as StoredJobDescription;
}
