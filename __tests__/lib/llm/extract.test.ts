// ============================================================
// __tests__/lib/llm/extract.test.ts
//
// Tests for the Groq extraction pipeline:
// - Happy path: valid JSON response passes Zod and returns ResumeData
// - Retry on validation failure: bad response triggers retry with error
// - Failure after max retries: throws ExtractionError
// - API call failure: wraps SDK error in ExtractionError
// ============================================================

import { extractResumeData, ExtractionError } from "@/lib/llm/extract";

// Mock the Groq client module entirely
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

const validResumeInput = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

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

describe("extractResumeData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGroqClient as jest.Mock).mockReturnValue(mockClient);
  });

  it("returns parsed ResumeData on a valid first response", async () => {
    mockCreate.mockResolvedValueOnce(makeGroqResponse(validResumeInput));

    const result = await extractResumeData("Jane Doe resume text...");

    expect(result.name).toBe("Alice Chen");
    expect(result.skills).toContain("TypeScript");
    expect(result.experience[0].company).toBe("TechCorp");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries with validation error message when Zod fails on first attempt", async () => {
    const badInput = { ...validResumeInput, name: "" }; // empty name fails validation
    const goodInput = validResumeInput;

    mockCreate
      .mockResolvedValueOnce(makeGroqResponse(badInput))
      .mockResolvedValueOnce(makeGroqResponse(goodInput));

    const result = await extractResumeData("resume text");

    expect(result.name).toBe("Alice Chen");
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Second call messages should include the validation error
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    // Find the correction turn: the second user message (after the initial one)
    const userMessages = secondCallMessages.filter((m: { role: string }) => m.role === "user");
    const correctionMessage = userMessages[userMessages.length - 1];
    expect(correctionMessage.content).toContain("failed schema validation");
  });

  it("throws ExtractionError after max retries with persistent invalid output", async () => {
    const badInput = { name: "", skills: [], experience: [], education: [] };

    mockCreate.mockResolvedValue(makeGroqResponse(badInput));

    const promise = extractResumeData("resume text");
    await expect(promise).rejects.toThrow(ExtractionError);
    await expect(promise).rejects.toThrow("Resume extraction failed after");
  });

  it("throws ExtractionError if the LLM call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const promise = extractResumeData("resume text");
    await expect(promise).rejects.toThrow(ExtractionError);
    await expect(promise).rejects.toThrow("Groq API call failed");
  });
});
