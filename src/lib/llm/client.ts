// ============================================================
// lib/llm/client.ts
//
// Anthropic SDK singleton. Centralizing the client here means:
// - API key validation happens once at startup (fast fail)
// - Tests can mock this module without touching individual callers
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * The specific model we use throughout the app.
 * Defined once so it's easy to change for a demo or evaluation.
 */
export const MODEL_ID = "claude-sonnet-4-5";
