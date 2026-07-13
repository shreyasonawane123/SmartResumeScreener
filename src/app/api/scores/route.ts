// ============================================================
// app/api/scores/route.ts
//
// POST /api/scores
// Body: { job_description_id: string }
//
// Fetches only resumes scoped to the given job description,
// scores each, persists results, returns ranked candidates.
//
// GET /api/scores?job_description_id=<id>
// Returns previously stored scores for a job description.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { scoreCandidate, ScoringError } from "@/lib/llm/score";
import { getResumesByJobDescription } from "@/lib/db/resumes";
import {
  insertScore,
  getScoresForJob,
  deleteScoresForJob,
} from "@/lib/db/scores";
import { getJobDescriptionById } from "@/lib/db/jobDescriptions";
import type { CandidateScore, ApiResponse } from "@/lib/types";
import { DbError } from "@/lib/db/resumes";

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CandidateScore[]>>> {
  let body: { job_description_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { job_description_id } = body;
  if (!job_description_id) {
    return NextResponse.json(
      { data: null, error: "job_description_id is required." },
      { status: 400 },
    );
  }

  // Fetch the job description text
  let jobDescription;
  try {
    jobDescription = await getJobDescriptionById(job_description_id);
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error:
          err instanceof DbError
            ? err.message
            : "Failed to fetch job description.",
      },
      { status: 500 },
    );
  }

  if (!jobDescription) {
    return NextResponse.json(
      { data: null, error: `Job description not found: ${job_description_id}` },
      { status: 404 },
    );
  }

  // Fetch only resumes that belong to this job description
  let resumes;
  try {
    resumes = await getResumesByJobDescription(job_description_id);
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: err instanceof DbError ? err.message : "Failed to fetch resumes.",
      },
      { status: 500 },
    );
  }

  if (resumes.length === 0) {
    return NextResponse.json(
      {
        data: null,
        error:
          "No resumes found for this job description. Upload resumes after selecting the job.",
      },
      { status: 422 },
    );
  }

  // Clear any previous scores for this job description before re-scoring
  try {
    await deleteScoresForJob(job_description_id);
  } catch {
    // Non-fatal: if deletion fails, we'll just accumulate scores
    console.warn("Failed to delete previous scores — continuing anyway.");
  }

  // Score each resume and save results
  const candidates: CandidateScore[] = [];
  const errors: string[] = [];

  for (const resume of resumes) {
    try {
      const scoreResult = await scoreCandidate(
        resume.structured_json,
        jobDescription.description_text,
      );

      const scoreId = await insertScore({
        resume_id: resume.id,
        job_description_id,
        score_result: scoreResult,
      });

      candidates.push({
        resume,
        score_result: scoreResult,
        score_id: scoreId,
        job_description_id,
      });
    } catch (err) {
      const message =
        err instanceof ScoringError || err instanceof DbError
          ? err.message
          : "Unknown error";
      errors.push(`${resume.filename}: ${message}`);
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score_result.score - a.score_result.score);

  if (candidates.length === 0) {
    return NextResponse.json(
      {
        data: null,
        error: `Scoring failed for all resumes. Errors: ${errors.join(" | ")}`,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    data: candidates,
    error: errors.length > 0 ? `Some resumes failed: ${errors.join(" | ")}` : null,
  });
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CandidateScore[]>>> {
  const { searchParams } = new URL(req.url);
  const job_description_id = searchParams.get("job_description_id");

  if (!job_description_id) {
    return NextResponse.json(
      { data: null, error: "job_description_id query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const scores = await getScoresForJob(job_description_id);
    return NextResponse.json({ data: scores, error: null });
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: err instanceof DbError ? err.message : "Failed to fetch scores.",
      },
      { status: 500 },
    );
  }
}
