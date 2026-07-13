// ============================================================
// lib/llm/client.ts
//
// Groq SDK singleton.
// Centralizes initialization and validates the GROQ_API_KEY.
// Groq provides a 100% free tier (no credit card needed) with
// access to fast open-source models like Llama 3.3 70B.
// Sign up and get your key at: https://console.groq.com
// ============================================================

import Groq from "groq-sdk";

let _client: Groq | null = null;

/**
 * Get the Groq client singleton.
 * @throws {Error} if GROQ_API_KEY is not configured
 */
export function getGroqClient(): Groq {
  if (_client) return _client;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local — get a free key at https://console.groq.com",
    );
  }

  _client = new Groq({ apiKey });
  return _client;
}

/**
 * The model for fast, structured JSON extraction and scoring.
 * llama-3.3-70b-versatile is available on the free tier and
 * is excellent at instruction-following and JSON output.
 */
export const MODEL_ID = "llama-3.3-70b-versatile";
