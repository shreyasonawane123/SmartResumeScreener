// ============================================================
// lib/llm/extract.ts
//
// Calls Groq's API to extract structured data from resume text.
// Uses Groq's JSON mode (response_format: { type: "json_object" })
// so the model is forced to return valid JSON, not prose.
//
// Retry logic: if Zod validation fails on the first attempt,
// we send the validation error back to the model and ask it to
// correct its output. Max 2 attempts total.
// ============================================================

import { getGroqClient, MODEL_ID } from "./client";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts";
import { ResumeDataSchema } from "@/lib/schemas";
import type { ResumeData } from "@/lib/types";
import { LLM_MAX_RETRIES } from "@/lib/constants";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Extract structured resume data from raw text using Groq (Llama 3.3 70B).
 * Validates the output with Zod and retries once if validation fails.
 *
 * @throws {ExtractionError} if both attempts fail
 */
export async function extractResumeData(resumeText: string): Promise<ResumeData> {
  const client = getGroqClient();

  // Build the message history. We'll append messages for retry turns.
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    { role: "user", content: EXTRACTION_USER_PROMPT(resumeText) },
  ];

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    if (attempt > 0 && lastError) {
      // Append the previous (bad) response is implicitly in history via the loop.
      // We just add a correction prompt as a new user turn.
      messages.push({
        role: "user",
        content: `Your previous response failed schema validation with this error: "${lastError}". Please correct the JSON and try again.`,
      });
    }

    let rawInput: unknown;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1024,
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new ExtractionError("Groq response did not contain text.");
      }

      // Append the assistant reply to history so the next retry has context
      messages.push({ role: "assistant", content: text });

      rawInput = JSON.parse(text);
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      throw new ExtractionError(
        `Groq API call failed: ${err instanceof Error ? err.message : "unknown error"}`,
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
