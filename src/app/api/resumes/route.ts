// ============================================================
// app/api/resumes/route.ts
//
// POST /api/resumes
// Accepts multipart form with:
//   - files: one or more resume files (PDF or TXT)
//   - job_description_id: UUID of the job this upload belongs to
//
// Resumes are scoped to a job description. Uploading without
// a job_description_id is rejected with 400.
//
// GET /api/resumes?job_description_id=<id>
// Returns resumes for a specific job only.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { extractPdfText, PdfParseError } from "@/lib/parsing/pdf";
import { extractPlainText, TextParseError } from "@/lib/parsing/text";
import { extractResumeData, ExtractionError } from "@/lib/llm/extract";
import { insertResume, getResumesByJobDescription } from "@/lib/db/resumes";
import { DbError } from "@/lib/db/resumes";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import type { StoredResume, ApiResponse } from "@/lib/types";

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<StoredResume[]>>> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid form data." },
      { status: 400 },
    );
  }

  // job_description_id is required — resumes must be scoped to an opening
  const job_description_id = formData.get("job_description_id") as string | null;
  if (!job_description_id) {
    return NextResponse.json(
      {
        data: null,
        error:
          "job_description_id is required. Select or create a job description before uploading.",
      },
      { status: 400 },
    );
  }

  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return NextResponse.json(
      { data: null, error: "No files uploaded. Attach at least one resume." },
      { status: 400 },
    );
  }

  const results: StoredResume[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported type "${file.type}". Upload PDF or plain text.`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.name}: file is too large (max 10 MB).`);
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Step 1: Extract raw text
      let rawText: string;
      if (file.type === "application/pdf") {
        rawText = await extractPdfText(buffer);
      } else {
        rawText = extractPlainText(buffer);
      }

      // Step 2: LLM extraction (Zod validation + retry built in)
      const structuredData = await extractResumeData(rawText);

      // Step 3: Persist to DB, scoped to the active job description
      const stored = await insertResume({
        job_description_id,
        filename: file.name,
        raw_text: rawText,
        structured_json: structuredData,
      });

      results.push(stored);
    } catch (err) {
      if (err instanceof PdfParseError || err instanceof TextParseError) {
        errors.push(`${file.name}: ${err.message}`);
      } else if (err instanceof ExtractionError) {
        errors.push(`${file.name}: LLM extraction failed — ${err.message}`);
      } else {
        errors.push(
          `${file.name}: unexpected error — ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { data: null, error: errors.join(" | ") },
      { status: 422 },
    );
  }

  return NextResponse.json({
    data: results,
    error: errors.length > 0 ? errors.join(" | ") : null,
  });
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<StoredResume[]>>> {
  const { searchParams } = new URL(req.url);
  const job_description_id = searchParams.get("job_description_id");

  if (!job_description_id) {
    return NextResponse.json(
      { data: null, error: "job_description_id query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const resumes = await getResumesByJobDescription(job_description_id);
    return NextResponse.json({ data: resumes, error: null });
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error:
          err instanceof DbError ? err.message : "Failed to fetch resumes.",
      },
      { status: 500 },
    );
  }
}
