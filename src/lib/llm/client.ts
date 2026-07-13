// ============================================================
// lib/llm/client.ts
//
// Gemini SDK singleton.
// centralizes initialization and validates the GEMINI_API_KEY.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

/**
 * Get the Google Generative AI client singleton.
 * @throws {Error} if GEMINI_API_KEY is not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

/**
 * The standard model for fast, structured JSON text generation.
 * gemini-2.0-flash is fully active on the free tier.
 */
export const MODEL_ID = "gemini-2.0-flash";
