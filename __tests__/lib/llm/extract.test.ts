// ============================================================
// __tests__/lib/llm/extract.test.ts
//
// Tests for the Gemini extraction pipeline:
// - Happy path: valid JSON response passes Zod and returns ResumeData
// - Retry on validation failure: bad response triggers retry with error
// - Failure after max retries: throws ExtractionError
// - API call failure: wraps SDK error in ExtractionError
// ============================================================

import { extractResumeData, ExtractionError } from "@/lib/llm/extract";

// Mock the Gemini client module entirely
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

const validResumeInput = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

function makeGeminiResponse(input: object) {
  return {
    response: {
      text: () => JSON.stringify(input),
    },
  };
}

describe("extractResumeData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGeminiClient as jest.Mock).mockReturnValue(mockClient);
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });
    mockStartChat.mockReturnValue({ sendMessage: mockSendMessage });
  });

  it("returns parsed ResumeData on a valid first response", async () => {
    mockSendMessage.mockResolvedValueOnce(makeGeminiResponse(validResumeInput));

    const result = await extractResumeData("Jane Doe resume text...");

    expect(result.name).toBe("Alice Chen");
    expect(result.skills).toContain("TypeScript");
    expect(result.experience[0].company).toBe("TechCorp");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("retries with validation error message when Zod fails on first attempt", async () => {
    const badInput = { ...validResumeInput, name: "" }; // empty name fails validation
    const goodInput = validResumeInput;

    mockSendMessage
      .mockResolvedValueOnce(makeGeminiResponse(badInput))
      .mockResolvedValueOnce(makeGeminiResponse(goodInput));

    const result = await extractResumeData("resume text");

    expect(result.name).toBe("Alice Chen");
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // Second call should include the validation error in the message
    const secondCallArg = mockSendMessage.mock.calls[1][0];
    expect(secondCallArg).toContain("failed schema validation");
  });

  it("throws ExtractionError after max retries with persistent invalid output", async () => {
    const badInput = { name: "", skills: [], experience: [], education: [] };

    mockSendMessage.mockResolvedValue(makeGeminiResponse(badInput));

    const promise = extractResumeData("resume text");
    await expect(promise).rejects.toThrow(ExtractionError);
    await expect(promise).rejects.toThrow("Resume extraction failed after");
  });

  it("throws ExtractionError if the LLM call throws", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const promise = extractResumeData("resume text");
    await expect(promise).rejects.toThrow(ExtractionError);
    await expect(promise).rejects.toThrow("Gemini API call failed");
  });
});
