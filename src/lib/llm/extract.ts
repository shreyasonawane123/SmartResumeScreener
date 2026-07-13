// ============================================================
// lib/llm/extract.ts
//
// Calls Google's Gemini API to extract structured data from resume text.
// Uses Gemini's responseMimeType: "application/json" and responseSchema
// configuration to force the model to return valid structured JSON.
//
// Retry logic: if Zod validation fails on the first attempt,
// we send the validation error back to the model and ask it to
// correct its output. Max 2 attempts total.
// ============================================================

import { getGeminiClient, MODEL_ID } from "./client";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts";
import { ResumeDataSchema } from "@/lib/schemas";
import type { ResumeData } from "@/lib/types";
import { LLM_MAX_RETRIES } from "@/lib/constants";
import { Schema } from "@google/generative-ai";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

// Gemini Schema defining the expected output structure.
// Using string literals instead of the Type enum avoids Jest ESM/CJS import issues.
const EXTRACTION_SCHEMA: Schema = {
  type: "object" as any,
  properties: {
    name: { type: "string" as any, description: "Candidate full name" },
    skills: {
      type: "array" as any,
      items: { type: "string" as any },
      description: "Technical and soft skills",
    },
    experience: {
      type: "array" as any,
      items: {
        type: "object" as any,
        properties: {
          role: { type: "string" as any },
          company: { type: "string" as any },
          years: { type: "number" as any },
        },
        required: ["role", "company", "years"],
      },
    },
    education: {
      type: "array" as any,
      items: {
        type: "object" as any,
        properties: {
          degree: { type: "string" as any },
          institution: { type: "string" as any },
        },
        required: ["degree", "institution"],
      },
    },
  },
  required: ["name", "skills", "experience", "education"],
};

/**
 * Extract structured resume data from raw text using Gemini.
 * Validates the output with Zod and retries once if validation fails.
 *
 * @throws {ExtractionError} if both attempts fail
 */
export async function extractResumeData(resumeText: string): Promise<ResumeData> {
  const client = getGeminiClient();

  // Initialize conversations with system instructions
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: EXTRACTION_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_SCHEMA,
    },
  });

  const chat = model.startChat({
    history: [],
  });

  let nextPrompt = EXTRACTION_USER_PROMPT(resumeText);
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    if (attempt > 0 && lastError) {
      nextPrompt = `Your previous response failed schema validation with this error: "${lastError}". Please correct the JSON and try again.`;
    }

    let rawInput: unknown;
    try {
      const response = await chat.sendMessage(nextPrompt);
      const text = response.response.text();
      if (!text) {
        throw new ExtractionError("Gemini response did not contain text.");
      }
      rawInput = JSON.parse(text);
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      throw new ExtractionError(
        `Gemini API call failed: ${err instanceof Error ? err.message : "unknown error"}`,
        err,
      );
    }

    // Validate the extracted JSON against our Zod schema
    const parsed = ResumeDataSchema.safeParse(rawInput);
    if (parsed.success) {
      return parsed.data as ResumeData;
    }

    // Format Zod errors for the retry prompt
    lastError = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    if (attempt === LLM_MAX_RETRIES) {
      throw new ExtractionError(
        `Resume extraction failed after ${LLM_MAX_RETRIES + 1} attempts. Last validation error: ${lastError}`,
      );
    }
  }

  throw new ExtractionError("Extraction failed unexpectedly.");
}
