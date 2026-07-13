// ============================================================
// lib/parsing/text.ts
//
// Handle plain .txt resume uploads.
// Mostly a passthrough, but sanitizes encoding issues and
// enforces the same non-empty contract as the PDF extractor.
// ============================================================

export class TextParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TextParseError";
  }
}

/**
 * Convert a plain-text Buffer into a clean string.
 * @throws {TextParseError} if the buffer decodes to empty content.
 */
export function extractPlainText(buffer: Buffer): string {
  // Decode as UTF-8; replace replacement characters from bad encodings
  const text = buffer.toString("utf-8").replace(/\uFFFD/g, " ").trim();

  if (!text) {
    throw new TextParseError("Uploaded text file appears to be empty.");
  }

  return text;
}
