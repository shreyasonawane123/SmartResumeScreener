// ============================================================
// lib/db/scores.ts
// ============================================================

import { getSupabaseClient } from "./client";
import type { ScoreResult, CandidateScore, StoredResume } from "@/lib/types";
import { DbError } from "./resumes";

interface InsertScoreParams {
  resume_id: string;
  job_description_id: string;
  score_result: ScoreResult;
}

interface RawScoreRow {
  id: string;
  resume_id: string;
  job_description_id: string;
  score: number;
  justification: string;
  matched_skills: string[];
  missing_skills: string[];
  created_at: string;
  resumes: StoredResume;
}

/** Save a score result and return the row ID. */
export async function insertScore(params: InsertScoreParams): Promise<string> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("scores")
    .insert({
      resume_id: params.resume_id,
      job_description_id: params.job_description_id,
      score: params.score_result.score,
      justification: params.score_result.justification,
      matched_skills: params.score_result.matched_skills,
      missing_skills: params.score_result.missing_skills,
    })
    .select("id")
    .single();

  if (error) {
    throw new DbError(`Failed to save score: ${error.message}`, error);
  }

  return data.id as string;
}

/**
 * Fetch all scored candidates for a job description,
 * joined with resume data, sorted by score descending.
 */
export async function getScoresForJob(
  jobDescriptionId: string,
): Promise<CandidateScore[]> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("scores")
    .select(
      `
      id,
      resume_id,
      job_description_id,
      score,
      justification,
      matched_skills,
      missing_skills,
      created_at,
      resumes (
        id,
        filename,
        raw_text,
        structured_json,
        created_at
      )
    `,
    )
    .eq("job_description_id", jobDescriptionId)
    .order("score", { ascending: false });

  if (error) {
    throw new DbError(`Failed to fetch scores: ${error.message}`, error);
  }

  return ((data ?? []) as unknown as RawScoreRow[]).map((row) => ({
    resume: row.resumes,
    score_result: {
      score: row.score,
      justification: row.justification,
      matched_skills: row.matched_skills,
      missing_skills: row.missing_skills,
    },
    score_id: row.id,
    job_description_id: row.job_description_id,
  }));
}

/**
 * Delete all existing scores for a job description before re-scoring.
 * This avoids duplicate score rows if the user re-runs analysis.
 */
export async function deleteScoresForJob(jobDescriptionId: string): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db
    .from("scores")
    .delete()
    .eq("job_description_id", jobDescriptionId);

  if (error) {
    throw new DbError(
      `Failed to delete existing scores: ${error.message}`,
      error,
    );
  }
}
