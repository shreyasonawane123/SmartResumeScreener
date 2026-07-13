// ============================================================
// __tests__/lib/llm/extract.test.ts
//
// Tests for the extraction pipeline:
// - Happy path: valid tool_use response passes Zod and returns ResumeData
// - Retry on validation failure: bad response triggers retry with error
// - Failure after max retries: throws ExtractionError
// - LLM call failure: wraps SDK error in ExtractionError
// ============================================================

import { extractResumeData, ExtractionError } from "@/lib/llm/extract";

// Mock the Anthropic client module entirely
jest.mock("@/lib/llm/client", () => ({
  getAnthropicClient: jest.fn(),
  MODEL_ID: "claude-sonnet-4-5",
}));

import { getAnthropicClient } from "@/lib/llm/client";

const mockCreate = jest.fn();
const mockClient = { messages: { create: mockCreate } };
(getAnthropicClient as jest.Mock).mockReturnValue(mockClient);

// A valid resume data response matching the Zod schema
const validResumeInput = {
  name: "Alice Chen",
  skills: ["TypeScript", "React", "Node.js"],
  experience: [{ role: "Software Engineer", company: "TechCorp", years: 3 }],
  education: [{ degree: "B.S. Computer Science", institution: "MIT" }],
};

function makeToolUseResponse(input: object) {
  return {
    content: [{ type: "tool_use", name: "extract_resume_data", input }],
    stop_reason: "tool_use",
  };
}

describe("extractResumeData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAnthropicClient as jest.Mock).mockReturnValue(mockClient);
  });

  it("returns parsed ResumeData on a valid first response", async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse(validResumeInput));

    const result = await extractResumeData("Jane Doe resume text...");

    expect(result.name).toBe("Alice Chen");
    expect(result.skills).toContain("TypeScript");
    expect(result.experience[0].company).toBe("TechCorp");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries with validation error message when Zod fails on first attempt", async () => {
    // First response: score out of range (invalid by Zod) — actually years is invalid
    const badInput = { ...validResumeInput, name: "" }; // empty name fails validation
    const goodInput = validResumeInput;

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse(badInput))
      .mockResolvedValueOnce(makeToolUseResponse(goodInput));

    const result = await extractResumeData("resume text");

    expect(result.name).toBe("Alice Chen");
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Second call should include the validation error in the messages
    const secondCallArgs = mockCreate.mock.calls[1][0];
    const messages = secondCallArgs.messages as Array<{ role: string; content: string }>;
    const retryMessage = messages.find((m) => m.role === "user" && m.content.includes("failed schema validation"));
    expect(retryMessage).toBeDefined();
  });

  it("throws ExtractionError after max retries with persistent invalid output", async () => {
    const badInput = { name: "", skills: [], experience: [], education: [] };

    mockCreate.mockResolvedValue(makeToolUseResponse(badInput));

    await expect(extractResumeData("resume text")).rejects.toThrow(ExtractionError);
    await expect(extractResumeData("resume text")).rejects.toThrow(
      "Resume extraction failed after",
    );
  });

  it("throws ExtractionError if the LLM call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    await expect(extractResumeData("resume text")).rejects.toThrow(ExtractionError);
    await expect(extractResumeData("resume text")).rejects.toThrow("LLM call failed");
  });

  it("throws ExtractionError if response has no tool_use block", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Here is the data..." }],
      stop_reason: "end_turn",
    });

    await expect(extractResumeData("resume text")).rejects.toThrow(ExtractionError);
    await expect(extractResumeData("resume text")).rejects.toThrow("tool_use block");
  });
});
