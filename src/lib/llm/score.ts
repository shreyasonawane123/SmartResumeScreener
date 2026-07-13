// ============================================================
// lib/llm/score.ts
//
// Scores a candidate's extracted resume data against a job
// description using Groq's API (Llama 3.3 70B).
// Uses JSON mode to guarantee structured output.
// ============================================================

import { getGroqClient, MODEL_ID } from "./client";
import { SCORING_SYSTEM_PROMPT, SCORING_USER_PROMPT } from "./prompts";
import { ScoreResultSchema } from "@/lib/schemas";
import type { ResumeData, ScoreResult } from "@/lib/types";
import { LLM_MAX_RETRIES } from "@/lib/constants";

export class ScoringError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

/**
 * Score a candidate resume against a job description using Groq (Llama 3.3 70B).
 * Returns a ScoreResult with score (1–10), justification, and skill arrays.
 *
 * @throws {ScoringError} if the LLM call fails or output fails Zod validation
 */
export async function scoreCandidate(
  resumeData: ResumeData,
  jobDescriptionText: string,
): Promise<ScoreResult> {
  const client = getGroqClient();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SCORING_SYSTEM_PROMPT },
    { role: "user", content: SCORING_USER_PROMPT(resumeData, jobDescriptionText) },
  ];

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    if (attempt > 0 && lastError) {
      messages.push({
        role: "user",
        content: `Your previous response failed validation: "${lastError}". Please correct and try again.`,
      });
    }

    let rawInput: unknown;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 512,
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new ScoringError("Groq response did not contain text.");
      }

      // Append assistant reply for retry context
      messages.push({ role: "assistant", content: text });

      rawInput = JSON.parse(text);
    } catch (err) {
      if (err instanceof ScoringError) throw err;
      throw new ScoringError(
        `Groq API scoring call failed: ${err instanceof Error ? err.message : "unknown error"}`,
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
