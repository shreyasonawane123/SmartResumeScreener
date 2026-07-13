// ============================================================
// app/api/resumes/route.ts
//
// POST /api/resumes
// Accepts a multipart form with one or more resume files.
// Parses each file, runs LLM extraction, saves to DB.
// Returns the stored resume records.
//
// This handler does request/response only. All business logic
// (parsing, extraction, DB writes) lives in /lib.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { extractPdfText, PdfParseError } from "@/lib/parsing/pdf";
import { extractPlainText, TextParseError } from "@/lib/parsing/text";
import { extractResumeData, ExtractionError } from "@/lib/llm/extract";
import { insertResume } from "@/lib/db/resumes";
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
    // Validate file type and size before touching the content
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported file type "${file.type}". Upload PDF or plain text.`);
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

      // Step 2: LLM extraction (with Zod validation + retry built in)
      const structuredData = await extractResumeData(rawText);

      // Step 3: Persist to DB
      const stored = await insertResume({
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
        errors.push(`${file.name}: unexpected error — ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  // If nothing succeeded, return an error response
  if (results.length === 0) {
    return NextResponse.json(
      { data: null, error: errors.join(" | ") },
      { status: 422 },
    );
  }

  // Partial success: return results with errors in the response body
  return NextResponse.json(
    {
      data: results,
      error: errors.length > 0 ? errors.join(" | ") : null,
    },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse<ApiResponse<StoredResume[]>>> {
  try {
    const { getAllResumes } = await import("@/lib/db/resumes");
    const resumes = await getAllResumes();
    return NextResponse.json({ data: resumes, error: null });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : "Failed to fetch resumes." },
      { status: 500 },
    );
  }
}
