// ============================================================
// lib/llm/extract.ts
//
// Calls the LLM to extract structured data from resume text.
// Uses Anthropic tool_use to force a typed JSON response —
// this is more reliable than parsing prose for a JSON block.
//
// Retry logic: if Zod validation fails on the first attempt,
// we send the validation error back to the model and ask it to
// correct its output. Max 2 attempts total.
// ============================================================

import { getAnthropicClient, MODEL_ID } from "./client";
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

import Anthropic from "@anthropic-ai/sdk";

// The tool definition tells Claude exactly what JSON shape to emit.
// tool_use is more reliable than asking for JSON in a system prompt
// because the model is explicitly constrained to the input_schema.
const EXTRACTION_TOOL: Anthropic.Messages.Tool = {
  name: "extract_resume_data",
  description: "Extract structured information from resume text and return as JSON.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Candidate full name" },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "Technical and soft skills",
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            role: { type: "string" },
            company: { type: "string" },
            years: { type: "number" },
          },
          required: ["role", "company", "years"],
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          properties: {
            degree: { type: "string" },
            institution: { type: "string" },
          },
          required: ["degree", "institution"],
        },
      },
    },
    required: ["name", "skills", "experience", "education"],
  },
};

/**
 * Extract structured resume data from raw text using the LLM.
 * Validates the output with Zod and retries once if validation fails.
 *
 * @throws {ExtractionError} if both attempts fail (LLM error or invalid JSON schema)
 */
export async function extractResumeData(resumeText: string): Promise<ResumeData> {
  const client = getAnthropicClient();

  // Build the initial message list — may be extended on retry
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: EXTRACTION_USER_PROMPT(resumeText) },
  ];

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    // On retry, append the validation error so the model can self-correct
    if (attempt > 0 && lastError) {
      messages.push({
        role: "user",
        content: `Your previous response failed schema validation with this error: "${lastError}". Please correct the JSON and try again.`,
      });
    }

    let rawInput: unknown;
    try {
      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        system: EXTRACTION_SYSTEM_PROMPT,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "extract_resume_data" },
        messages,
      });

      // Find the tool_use block in the response
      const toolUseBlock = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
          block.type === "tool_use",
      );

      if (!toolUseBlock) {
        throw new ExtractionError("LLM response did not contain a tool_use block.");
      }

      rawInput = toolUseBlock.input;
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      throw new ExtractionError(
        `LLM call failed: ${err instanceof Error ? err.message : "unknown error"}`,
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

  // TypeScript requires a return here, but the loop always returns or throws
  throw new ExtractionError("Extraction failed unexpectedly.");
}
