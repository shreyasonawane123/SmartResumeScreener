// ============================================================
// lib/llm/score.ts
//
// Scores a candidate's extracted resume data against a job
// description using Google's Gemini API.
// ============================================================

import { getGeminiClient, MODEL_ID } from "./client";
import { SCORING_SYSTEM_PROMPT, SCORING_USER_PROMPT } from "./prompts";
import { ScoreResultSchema } from "@/lib/schemas";
import type { ResumeData, ScoreResult } from "@/lib/types";
import { LLM_MAX_RETRIES } from "@/lib/constants";
import { Schema } from "@google/generative-ai";

export class ScoringError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

// Gemini Schema defining the expected output structure.
// Using string literals instead of the Type enum avoids Jest ESM/CJS import issues.
const SCORING_SCHEMA: Schema = {
  type: "object" as any,
  properties: {
    score: {
      type: "number" as any,
      description: "Fit score from 1 (very poor) to 10 (excellent)",
    },
    justification: {
      type: "string" as any,
      description: "2-4 sentence explanation of the score",
    },
    matched_skills: {
      type: "array" as any,
      items: { type: "string" as any },
      description: "Skills the candidate has that match the JD",
    },
    missing_skills: {
      type: "array" as any,
      items: { type: "string" as any },
      description: "Skills the JD requires that the candidate lacks",
    },
  },
  required: ["score", "justification", "matched_skills", "missing_skills"],
};

/**
 * Score a candidate resume against a job description using Gemini.
 * Returns a ScoreResult with score (1–10), justification, and skill arrays.
 *
 * @throws {ScoringError} if the LLM call fails or output fails Zod validation
 */
export async function scoreCandidate(
  resumeData: ResumeData,
  jobDescriptionText: string,
): Promise<ScoreResult> {
  const client = getGeminiClient();

  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: SCORING_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCORING_SCHEMA,
    },
  });

  const chat = model.startChat({
    history: [],
  });

  let nextPrompt = SCORING_USER_PROMPT(resumeData, jobDescriptionText);
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    if (attempt > 0 && lastError) {
      nextPrompt = `Your previous response failed validation: "${lastError}". Please correct and try again.`;
    }

    let rawInput: unknown;
    try {
      const response = await chat.sendMessage(nextPrompt);
      const text = response.response.text();
      if (!text) {
        throw new ScoringError("Gemini response did not contain text.");
      }
      rawInput = JSON.parse(text);
    } catch (err) {
      if (err instanceof ScoringError) throw err;
      throw new ScoringError(
        `Gemini API scoring call failed: ${err instanceof Error ? err.message : "unknown error"}`,
        err,
      );
    }

    const parsed = ScoreResultSchema.safeParse(rawInput);
    if (parsed.success) {
      return parsed.data as ScoreResult;
    }

    lastError = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    if (attempt === LLM_MAX_RETRIES) {
      throw new ScoringError(
        `Scoring failed after ${LLM_MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
      );
    }
  }

  throw new ScoringError("Scoring failed unexpectedly.");
}
