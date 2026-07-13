// ============================================================
// __tests__/lib/llm/score.test.ts
// ============================================================

import { scoreCandidate, ScoringError } from "@/lib/llm/score";
import type { ResumeData } from "@/lib/types";

jest.mock("@/lib/llm/client", () => ({
  getAnthropicClient: jest.fn(),
  MODEL_ID: "claude-sonnet-4-5",
}));

import { getAnthropicClient } from "@/lib/llm/client";

const mockCreate = jest.fn();
const mockClient = { messages: { create: mockCreate } };
(getAnthropicClient as jest.Mock).mockReturnValue(mockClient);

const sampleResume: ResumeData = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

const sampleJD =
  "We need a senior full-stack engineer with 5+ years TypeScript, React, Node.js, and AWS experience.";

function makeScoreResponse(input: object) {
  return {
    content: [{ type: "tool_use", name: "score_candidate", input }],
    stop_reason: "tool_use",
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
    (getAnthropicClient as jest.Mock).mockReturnValue(mockClient);
  });

  it("returns a ScoreResult with correct values on valid response", async () => {
    mockCreate.mockResolvedValueOnce(makeScoreResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);

    expect(result.score).toBe(7);
    expect(result.matched_skills).toContain("TypeScript");
    expect(result.missing_skills).toContain("AWS");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries on Zod validation failure (score out of range)", async () => {
    const badScore = { ...validScoreInput, score: 11 }; // max is 10
    mockCreate
      .mockResolvedValueOnce(makeScoreResponse(badScore))
      .mockResolvedValueOnce(makeScoreResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);
    expect(result.score).toBe(7);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws ScoringError after persistent invalid scores", async () => {
    const badScore = { score: 0, justification: "too short", matched_skills: [], missing_skills: [] };
    mockCreate.mockResolvedValue(makeScoreResponse(badScore));

    await expect(scoreCandidate(sampleResume, sampleJD)).rejects.toThrow(ScoringError);
  });

  it("throws ScoringError if the API call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Connection timeout"));

    await expect(scoreCandidate(sampleResume, sampleJD)).rejects.toThrow(ScoringError);
    await expect(scoreCandidate(sampleResume, sampleJD)).rejects.toThrow(
      "LLM scoring call failed",
    );
  });

  it("passes resume JSON and job description to the LLM", async () => {
    mockCreate.mockResolvedValueOnce(makeScoreResponse(validScoreInput));

    await scoreCandidate(sampleResume, sampleJD);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;
    expect(userMessage).toContain("Alice Chen");
    expect(userMessage).toContain(sampleJD);
  });
});
