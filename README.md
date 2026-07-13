# SmartResume Screener

An evaluation tool that handles structured resume parsing and match scoring against job requirements. The core design is built on a two-pass LLM pipeline (extract first, score second) to minimize token spend on job description edits.

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
- **`/src/lib/parsing/`**: Handles text extraction from uploads. Relies on `unpdf` instead of the traditional `pdf-parse` package because `unpdf` compiles with zero native binary bindings, preventing canvas dependency load failures in Vercel's serverless environment.
- **`/src/lib/llm/`**: Manages the LLM client configuration, prompt structures, and Anthropic tool configurations.
- **`/src/lib/db/`**: Handles direct Supabase CRUD database transactions.
- **`/src/app/api/`**: Simple request/response route endpoints. All logic is decoupled into `/lib` so that parsing, scoring, and database transactions can be unit tested without spawning the Next.js runtime.
- **`/src/components/`**: Clean Tailwind UI components. Stateful dashboard assembly is delegated to `src/app/page.tsx` to keep individual components highly reusable.

### Shortlisting Logic
- **How it works**: The default pass-mark threshold is stored in [`src/lib/constants.ts`](file:///src/lib/constants.ts) as `DEFAULT_SHORTLIST_THRESHOLD` (currently 7/10).
- **Client-Side Partitioning**: When a user changes the slider threshold on the dashboard, the list is re-partitioned into "Shortlisted" and "Other Candidates" instantly in the browser. This avoids expensive re-scoring LLM calls and database queries.
- **Requirement Fit**: This design directly satisfies the assignment's mandate to "display shortlisted candidates" with justification, visually elevating top fits while keeping the full candidate pool browsable.

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
