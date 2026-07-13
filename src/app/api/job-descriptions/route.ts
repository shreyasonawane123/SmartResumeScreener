// ============================================================
// app/api/job-descriptions/route.ts
//
// POST /api/job-descriptions  — save a new job description
// GET  /api/job-descriptions  — list all saved job descriptions
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { insertJobDescription, getAllJobDescriptions } from "@/lib/db/jobDescriptions";
import { JobDescriptionSchema } from "@/lib/schemas";
import type { StoredJobDescription, ApiResponse } from "@/lib/types";
import { DbError } from "@/lib/db/resumes";

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<StoredJobDescription>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = JobDescriptionSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json(
      { data: null, error: `Validation failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    const stored = await insertJobDescription(parsed.data);
    return NextResponse.json({ data: stored, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error:
          err instanceof DbError
            ? err.message
            : "Failed to save job description.",
      },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<StoredJobDescription[]>>> {
  try {
    const jds = await getAllJobDescriptions();
    return NextResponse.json({ data: jds, error: null });
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error:
          err instanceof DbError
            ? err.message
            : "Failed to fetch job descriptions.",
      },
      { status: 500 },
    );
  }
}
