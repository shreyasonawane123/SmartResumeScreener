# SmartResume Screener

A developer-friendly screening dashboard that parses PDF/text resumes, extracts structured profiles, and ranks candidates against a job description using structured LLM calls and a configurable shortlisting threshold.

## Architecture Overview

```
                      +-------------------+
                      |   User Dashboard  |
                      |   (Next.js App)   |
                      +----+---------+----+
                           |         ^
          1. Upload Resume |         | 4. Ranked List
                           v         |
                     +-----+---------+----+
                     |  Next.js API Route |
                     |  (/app/api/*)      |
                     +-----+---------+----+
                           |         |
      2. Parse & Extract   |         | 3. Store Structured
      (Claude Tool Use)    v         |    Data & Scores
                     +-----+---------+----+
                     |  Anthropic API     | <--->  Supabase DB
                     |  (claude-sonnet-5) |        (PostgreSQL)
                     +--------------------+
```

### Separation of Concerns
- **`/lib/parsing/`**: Serverless-safe text extraction from PDF and plain text buffers. PDF parsing utilizes `unpdf` (wrapping `pdf.js` with zero native dependencies) to avoid container/serverless canvas binary crashes.
- **`/lib/llm/`**: Anthropic client integration and business logic for schema extraction and candidate scoring.
- **`/lib/db/`**: CRUD operations on Postgres via the Supabase JS client.
- **`/app/api/`**: Request/response wrappers only. The API routes do not contain business or data logic, making the parsing and scoring layers independently testable.
- **`/components/`**: Modular frontend UI widgets built with Tailwind CSS.

---

## LLM Prompts & Structured Validation

The app uses two separate prompts rather than one mega-prompt. This keeps individual tasks simple for the model, reduces token usage on re-scoring, and makes it easy to explain or audit.

Both prompts are defined in [`src/lib/llm/prompts.ts`](file:///src/lib/llm/prompts.ts).

### 1. Resume Extraction Prompt
Converts raw, unstructured resume text into a structured profile schema.
- **Why it's structured this way**: It provides an explicit TypeScript-mirror output schema, a few-shot worked example to align format expectations (especially converting text durations into numbers), and instructions to reason step-by-step internally.
- **Tool Use Constraints**: Rather than relying on Claude to output valid JSON in markdown blocks, we use the Anthropic Tool Use API, forcing the model to respond by calling a schema-validated tool: `extract_resume_data`.
- **Validation & Retry**: The backend validates the model's output using Zod. If the model outputs bad schema structures, the system automatically retries once by appending the Zod validation issues back to the prompt, allowing the model to self-correct.

### 2. Candidate Scoring Prompt
Rates candidate fit on a 1–10 scale against a job description.
- **Why it's structured this way**: Inputs are passed as pre-structured JSON (reducing noise). It specifies score calibration (1–3 for major gaps, 4–6 for partial fit, 7–8 for good fit, 9–10 for excellent fit) to prevent score drift, and requires both matched and missing skill lists to drive frontend chips.
- **Tool Use Constraints**: Forces response using the `score_candidate` tool.

---

## Setup & Running Locally

### 1. Database Setup
Create a free project at [supabase.com](https://supabase.com). Go to the SQL Editor and execute the schema stub found in [`supabase/schema.sql`](file:///supabase/schema.sql). This will provision:
- `resumes` table: Stores filename, raw text, and structured profile JSON.
- `job_descriptions` table: Stores titles and requirements.
- `scores` table: Stores computed scores, justifications, matched, and missing skills.

### 2. Environment Configuration
Copy the template to create a local environment file:
```bash
cp .env.example .env.local
```
Fill in the credentials in `.env.local`:
- `ANTHROPIC_API_KEY`: Your Anthropic developer console API key.
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role API key (used server-side for database write bypass).

### 3. Install & Run
Install packages:
```bash
npm install
```
Start the Next.js development server:
```bash
npm run dev
```
Open `http://localhost:3000` to view the dashboard.

---

## Testing & Verifying

We write unit tests to verify parsing, validation retries, and scoring.

Run the test suite:
```bash
npm test
```

Check TypeScript compilation:
```bash
npm run type-check
```

---

## Known Limitations

- **Scanned Resumes**: The PDF text extractor runs entirely in memory without OCR. Scanned/image-only PDFs will fail with an extraction warning. Resumes must contain extractable text characters.
- **API Call Timeouts**: Scoring is performed sequentially. In production environments with a high volume of resumes, serverless function timeouts (typically 10s on Vercel Hobby plan) can be triggered. For larger batches, this should be refactored into a background worker queue.
- **Tokens/Cost**: Running two-stage LLM extraction and scoring calls on every upload accumulates token usage. The app mitigates this by storing structured JSON in Supabase so scoring can be run and adjusted without re-extracting resume structures.
