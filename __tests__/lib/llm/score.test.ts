// ============================================================
// __tests__/lib/llm/score.test.ts
// ============================================================

import { scoreCandidate, ScoringError } from "@/lib/llm/score";
import type { ResumeData } from "@/lib/types";

jest.mock("@/lib/llm/client", () => ({
  getGroqClient: jest.fn(),
  MODEL_ID: "llama-3.3-70b-versatile",
}));

import { getGroqClient } from "@/lib/llm/client";

const mockCreate = jest.fn();
const mockClient = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

(getGroqClient as jest.Mock).mockReturnValue(mockClient);

const sampleResume: ResumeData = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

const sampleJD =
  "We need a senior full-stack engineer with 5+ years TypeScript, React, Node.js, and AWS experience.";

function makeGroqResponse(input: object) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(input),
        },
      },
    ],
  };
}

const validScoreInput = {
  score: 7,
  justification:
    "Alice has strong TypeScript, React, and Node.js skills but lacks AWS experience and seniority.",
  matched_skills: ["TypeScript", "React", "Node.js"],
  missing_skills: ["AWS", "5+ years experience"],
};

describe("scoreCandidate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGroqClient as jest.Mock).mockReturnValue(mockClient);
  });

  it("returns a ScoreResult with correct values on valid response", async () => {
    mockCreate.mockResolvedValueOnce(makeGroqResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);

    expect(result.score).toBe(7);
    expect(result.matched_skills).toContain("TypeScript");
    expect(result.missing_skills).toContain("AWS");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries on Zod validation failure (score out of range)", async () => {
    const badScore = { ...validScoreInput, score: 11 }; // max is 10
    mockCreate
      .mockResolvedValueOnce(makeGroqResponse(badScore))
      .mockResolvedValueOnce(makeGroqResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);
    expect(result.score).toBe(7);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws ScoringError after persistent invalid scores", async () => {
    const badScore = { score: 0, justification: "too short", matched_skills: [], missing_skills: [] };
    mockCreate.mockResolvedValue(makeGroqResponse(badScore));

    const promise = scoreCandidate(sampleResume, sampleJD);
    await expect(promise).rejects.toThrow(ScoringError);
  });

  it("throws ScoringError if the API call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Connection timeout"));

    const promise = scoreCandidate(sampleResume, sampleJD);
    await expect(promise).rejects.toThrow(ScoringError);
    await expect(promise).rejects.toThrow("Groq API scoring call failed");
  });

  it("passes resume JSON and job description to the LLM", async () => {
    mockCreate.mockResolvedValueOnce(makeGroqResponse(validScoreInput));

    await scoreCandidate(sampleResume, sampleJD);

    const callMessages = mockCreate.mock.calls[0][0].messages;
    const userMessage = callMessages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("Alice Chen");
    expect(userMessage.content).toContain(sampleJD);
  });
});
