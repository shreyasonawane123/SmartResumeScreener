// ============================================================
// __tests__/lib/parsing/pdf.test.ts
// ============================================================

import { extractPdfText, PdfParseError } from "@/lib/parsing/pdf";

// Mock unpdf so we don't need actual PDFs in unit tests
jest.mock("unpdf", () => ({
  extractText: jest.fn(),
}));

import { extractText } from "unpdf";
const mockExtractText = extractText as jest.MockedFunction<typeof extractText>;

describe("extractPdfText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns trimmed text for a valid PDF buffer", async () => {
    mockExtractText.mockResolvedValue({ text: "  John Doe\nSoftware Engineer  " } as any);

    const buffer = Buffer.from("fake-pdf-bytes");
    const result = await extractPdfText(buffer);

    expect(result).toBe("John Doe\nSoftware Engineer");
    expect(mockExtractText).toHaveBeenCalledTimes(1);
  });

  it("throws PdfParseError if extracted text is empty", async () => {
    mockExtractText.mockResolvedValue({ text: "   " } as any);

    const buffer = Buffer.from("fake-pdf-bytes");
    await expect(extractPdfText(buffer)).rejects.toThrow(PdfParseError);
    await expect(extractPdfText(buffer)).rejects.toThrow("no extractable text");
  });

  it("throws PdfParseError if unpdf throws", async () => {
    mockExtractText.mockRejectedValue(new Error("PDF is corrupted"));

    const buffer = Buffer.from("not-a-pdf");
    await expect(extractPdfText(buffer)).rejects.toThrow(PdfParseError);
    await expect(extractPdfText(buffer)).rejects.toThrow("Failed to parse PDF");
  });

  it("wraps the original error as cause", async () => {
    const originalError = new Error("PDF is corrupted");
    mockExtractText.mockRejectedValue(originalError);

    const buffer = Buffer.from("not-a-pdf");
    try {
      await extractPdfText(buffer);
    } catch (err) {
      expect(err).toBeInstanceOf(PdfParseError);
      expect((err as PdfParseError).cause).toBe(originalError);
    }
  });
});
