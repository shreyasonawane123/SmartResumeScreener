// ============================================================
// __tests__/lib/llm/score.test.ts
// ============================================================

import { scoreCandidate, ScoringError } from "@/lib/llm/score";
import type { ResumeData } from "@/lib/types";

jest.mock("@/lib/llm/client", () => ({
  getGeminiClient: jest.fn(),
  MODEL_ID: "gemini-2.0-flash",
}));

import { getGeminiClient } from "@/lib/llm/client";

const mockSendMessage = jest.fn();
const mockStartChat = jest.fn().mockReturnValue({ sendMessage: mockSendMessage });
const mockGetGenerativeModel = jest.fn().mockReturnValue({ startChat: mockStartChat });
const mockClient = { getGenerativeModel: mockGetGenerativeModel };

(getGeminiClient as jest.Mock).mockReturnValue(mockClient);

const sampleResume: ResumeData = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

const sampleJD =
  "We need a senior full-stack engineer with 5+ years TypeScript, React, Node.js, and AWS experience.";

function makeGeminiResponse(input: object) {
  return {
    response: {
      text: () => JSON.stringify(input),
    },
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
    (getGeminiClient as jest.Mock).mockReturnValue(mockClient);
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });
    mockStartChat.mockReturnValue({ sendMessage: mockSendMessage });
  });

  it("returns a ScoreResult with correct values on valid response", async () => {
    mockSendMessage.mockResolvedValueOnce(makeGeminiResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);

    expect(result.score).toBe(7);
    expect(result.matched_skills).toContain("TypeScript");
    expect(result.missing_skills).toContain("AWS");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("retries on Zod validation failure (score out of range)", async () => {
    const badScore = { ...validScoreInput, score: 11 }; // max is 10
    mockSendMessage
      .mockResolvedValueOnce(makeGeminiResponse(badScore))
      .mockResolvedValueOnce(makeGeminiResponse(validScoreInput));

    const result = await scoreCandidate(sampleResume, sampleJD);
    expect(result.score).toBe(7);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("throws ScoringError after persistent invalid scores", async () => {
    const badScore = { score: 0, justification: "too short", matched_skills: [], missing_skills: [] };
    mockSendMessage.mockResolvedValue(makeGeminiResponse(badScore));

    const promise = scoreCandidate(sampleResume, sampleJD);
    await expect(promise).rejects.toThrow(ScoringError);
  });

  it("throws ScoringError if the API call throws", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("Connection timeout"));

    const promise = scoreCandidate(sampleResume, sampleJD);
    await expect(promise).rejects.toThrow(ScoringError);
    await expect(promise).rejects.toThrow("Gemini API scoring call failed");
  });

  it("passes resume JSON and job description to the LLM", async () => {
    mockSendMessage.mockResolvedValueOnce(makeGeminiResponse(validScoreInput));

    await scoreCandidate(sampleResume, sampleJD);

    const callArgs = mockSendMessage.mock.calls[0][0];
    expect(callArgs).toContain("Alice Chen");
    expect(callArgs).toContain(sampleJD);
  });
});
