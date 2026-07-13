// ============================================================
// lib/llm/score.ts
//
// Scores a candidate's extracted resume data against a job
// description. Returns a ScoreResult with score, justification,
// and matched/missing skill arrays.
//
// Separate from extract.ts because scoring is a distinct task
// that runs on already-structured data — not raw text.
// ============================================================

import { getAnthropicClient, MODEL_ID } from "./client";
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

import Anthropic from "@anthropic-ai/sdk";

// Tool definition for scoring — forces Claude to emit the exact shape we need
const SCORING_TOOL: Anthropic.Messages.Tool = {
  name: "score_candidate",
  description: "Score how well a candidate's resume matches a job description.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "number",
        description: "Fit score from 1 (very poor) to 10 (excellent)",
      },
      justification: {
        type: "string",
        description: "2–4 sentence explanation of the score",
      },
      matched_skills: {
        type: "array",
        items: { type: "string" },
        description: "Skills the candidate has that match the JD",
      },
      missing_skills: {
        type: "array",
        items: { type: "string" },
        description: "Skills the JD requires that the candidate lacks",
      },
    },
    required: ["score", "justification", "matched_skills", "missing_skills"],
  },
};

/**
 * Score a candidate resume against a job description.
 * Returns a ScoreResult with score (1–10), justification, and skill arrays.
 *
 * @throws {ScoringError} if the LLM call fails or output fails Zod validation
 */
export async function scoreCandidate(
  resumeData: ResumeData,
  jobDescriptionText: string,
): Promise<ScoreResult> {
  const client = getAnthropicClient();

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    {
      role: "user",
      content: SCORING_USER_PROMPT(resumeData, jobDescriptionText),
    },
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
      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 1024,
        system: SCORING_SYSTEM_PROMPT,
        tools: [SCORING_TOOL],
        tool_choice: { type: "tool", name: "score_candidate" },
        messages,
      });

      const toolUseBlock = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
          block.type === "tool_use",
      );

      if (!toolUseBlock) {
        throw new ScoringError("LLM response did not contain a tool_use block.");
      }

      rawInput = toolUseBlock.input;
    } catch (err) {
      if (err instanceof ScoringError) throw err;
      throw new ScoringError(
        `LLM scoring call failed: ${err instanceof Error ? err.message : "unknown error"}`,
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
