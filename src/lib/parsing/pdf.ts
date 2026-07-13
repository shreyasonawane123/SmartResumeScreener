// ============================================================
// lib/parsing/pdf.ts
//
// Extract raw text from a PDF buffer server-side.
// Uses `unpdf` rather than `pdf-parse` because unpdf has zero
// native dependencies and works reliably in Vercel serverless
// functions. pdf-parse crashes there due to its canvas bindings.
// ============================================================

import { extractText } from "unpdf";

export class PdfParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PdfParseError";
  }
}

/**
 * Convert a PDF Buffer into a single string of raw text.
 * Returns the extracted text, stripped of excess whitespace.
 *
 * @throws {PdfParseError} if the buffer is not a valid PDF or extraction fails.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // unpdf expects an ArrayBuffer, not a Node Buffer
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  let result: { text: string };
  try {
    result = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
  } catch (err) {
    throw new PdfParseError(
      `Failed to parse PDF: ${err instanceof Error ? err.message : "unknown error"}`,
      err,
    );
  }

  const text = result.text.trim();
  if (!text) {
    throw new PdfParseError(
      "PDF parsed successfully but contains no extractable text. " +
        "It may be a scanned image PDF — only text-based PDFs are supported.",
    );
  }

  return text;
}
