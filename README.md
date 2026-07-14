# SmartResume Screener

An evaluation tool that handles structured resume parsing and match scoring against job requirements. The core design is built on a two-pass LLM pipeline (extract first, score second) to minimize token spend on job description edits.

## Live Demo

**Deployed on Vercel:** [https://smart-resume-screener-seven.vercel.app/](https://smart-resume-screener-seven.vercel.app/)

> The live demo uses a shared Supabase instance and Groq API key. If the Groq free-tier rate limit is hit, wait 60 seconds and retry.

## Demo Video

A short walkthrough of the project — what it does, the architecture, and a live
demo of the upload → extract → score → shortlist flow:

**[Watch the demo video](https://drive.google.com/file/d/1b4JgwxnsJF7NP13jbLC68oWfcs54kIYg/view?usp=sharing)**

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
      (Groq JSON mode)     v         |    Data & Scores
                     +-----+---------+----+
                     |     Groq API       | <--->  Supabase DB
                     | (llama-3.3-70b-   |        (PostgreSQL)
                     |   versatile)       |
                     +--------------------+
```

### Separation of Concerns
- **`/src/lib/parsing/`**: Handles text extraction from uploads. Relies on `unpdf` instead of the traditional `pdf-parse` package because `unpdf` compiles with zero native binary bindings, preventing canvas dependency load failures in Vercel serverless environments.
- **`/src/lib/llm/`**: Manages the Groq client configuration, prompt structures, and structured output handling via `response_format: { type: "json_schema" }` — which forces the model to emit valid, schema-constrained JSON without relying on markdown prose blocks.
- **`/src/lib/db/`**: Handles direct Supabase CRUD database transactions.
- **`/src/app/api/`**: Simple request/response route endpoints. All logic is decoupled into `/lib` so that parsing, scoring, and database transactions can be unit tested without spawning the Next.js runtime.
- **`/src/components/`**: Clean Tailwind UI components. Stateful dashboard assembly is delegated to `src/app/page.tsx` to keep individual components highly reusable.

### Shortlisting Logic
- **How it works**: The default pass-mark threshold is stored in `src/lib/constants.ts` as `DEFAULT_SHORTLIST_THRESHOLD` (currently 7/10).
- **Client-Side Partitioning**: When a user changes the slider threshold on the dashboard, the list is re-partitioned into "Shortlisted" and "Other Candidates" instantly in the browser. This avoids expensive re-scoring LLM calls and database queries.
- **Requirement Fit**: This design directly satisfies the assignment mandate to "display shortlisted candidates" with justification, visually elevating top fits while keeping the full pool browsable.

---

## LLM Prompts & Structured Validation

The app uses two separate prompts rather than one mega-prompt. This keeps individual tasks simple for the model, reduces token usage on re-scoring, and makes it easy to explain or audit.

Both prompts are defined in `src/lib/llm/prompts.ts`.

### 1. Resume Extraction Prompt
Converts raw, unstructured resume text into a structured profile schema.
- **Why it's structured this way**: It provides an explicit TypeScript-mirror output schema, a few-shot worked example to align format expectations (especially converting text durations into numbers), and instructions to reason step-by-step internally.
- **Structured JSON Schema**: Rather than relying on the model to output valid JSON in markdown prose blocks, we configure the Groq request with `response_format: { type: "json_schema", json_schema: { ... } }`, which instructs the model to produce output strictly conforming to a declared JSON Schema object. This is Groq's constrained-generation mode — analogous to OpenAI's structured outputs — and is more reliable than plain `json_object` mode because the schema itself is enforced, not just JSON syntax.
- **Validation & Retry**: The backend validates the model's output using Zod. If the model outputs bad schema structures, the system automatically retries once by sending the Zod validation issues back in the message thread, allowing the model to self-correct.

#### Actual Prompt Text (System Prompt)
```
You are a resume parser. Your job is to extract structured information from resume text.

OUTPUT SCHEMA:
{
  "name": string,           // candidate's full name
  "skills": string[],       // technical and soft skills, each as a short phrase
  "experience": [
    {
      "role": string,       // job title
      "company": string,    // employer name
      "years": number       // duration in years (e.g. 2.5); use 0 if not stated
    }
  ],
  "education": [
    {
      "degree": string,     // e.g. "B.S. Computer Science", "MBA"
      "institution": string // university or school name
    }
  ]
}

RULES:
- Extract only what is explicitly stated. Do not infer or fabricate.
- Skills should be atomic (e.g. "React" not "React, Node.js, TypeScript").
- If a field has no data in the resume, use an empty array [] or empty string "".
- Reason through the resume section by section internally, then emit ONLY the final JSON.

EXAMPLE:

Input resume text:
---
Jane Smith
jane.smith@email.com | github.com/jsmith

SKILLS: Python, SQL, Pandas, scikit-learn, Tableau, Git

EXPERIENCE:
Data Analyst — Acme Corp (2020–2023)
- Built dashboards in Tableau for sales pipeline tracking
- Wrote Python ETL scripts processing 5M rows/day

Junior Analyst — Beta Inc (2018–2020)

EDUCATION:
B.S. Statistics, University of Michigan, 2018
---

Expected output:
{
  "name": "Jane Smith",
  "skills": ["Python", "SQL", "Pandas", "scikit-learn", "Tableau", "Git"],
  "experience": [
    { "role": "Data Analyst", "company": "Acme Corp", "years": 3 },
    { "role": "Junior Analyst", "company": "Beta Inc", "years": 2 }
  ],
  "education": [
    { "degree": "B.S. Statistics", "institution": "University of Michigan" }
  ]
}
```

### 2. Candidate Scoring Prompt
Rates candidate fit on a 1–10 scale against a job description.
- **Why it's structured this way**: Inputs are passed as pre-structured JSON (reducing noise). It specifies score calibration (1–3 for major gaps, 4–6 for partial fit, 7–8 for good fit, 9–10 for excellent fit) to prevent score drift, and requires both matched and missing skill lists to drive frontend chips.
- **Structured JSON Schema**: Configured with `response_format: { type: "json_schema", json_schema: { ... } }` on the request, enforcing that the score, justification, matched skills, and missing skills fields are all present and correctly typed in the model's response.

#### Actual Prompt Text (System Prompt)
```
You are a technical recruiter scoring how well a candidate fits a job description.

Given a candidate's structured resume data and a job description, rate the fit on a 1–10 scale.

OUTPUT SCHEMA:
{
  "score": number,             // 1 (very poor fit) to 10 (excellent fit), integer or one decimal
  "justification": string,     // 2–4 sentences explaining the score; be specific, not generic
  "matched_skills": string[],  // skills from the resume that match the JD requirements
  "missing_skills": string[]   // skills the JD asks for that the candidate doesn't have
}

SCORING GUIDE:
1–3: Major gaps — missing core requirements or substantially under-experienced
4–6: Partial fit — covers some requirements but notable gaps remain
7–8: Good fit — meets most requirements with minor gaps
9–10: Excellent fit — meets or exceeds all core and most secondary requirements

RULES:
- Reason through the candidate's skills and experience against the JD internally.
- Then emit ONLY the final JSON. No prose before or after the JSON.
- Be specific in justification: name actual skills, roles, or years that matter.
- matched_skills and missing_skills must each be a flat array of short strings.

EXAMPLE:

Candidate (structured JSON):
{
  "name": "Jane Smith",
  "skills": ["Python", "SQL", "Pandas", "scikit-learn", "Tableau", "Git"],
  "experience": [
    { "role": "Data Analyst", "company": "Acme Corp", "years": 3 },
    { "role": "Junior Analyst", "company": "Beta Inc", "years": 2 }
  ],
  "education": [{ "degree": "B.S. Statistics", "institution": "University of Michigan" }]
}

Job description:
"We need a Senior Data Scientist with 5+ years of experience in Python, ML model 
deployment, Spark, and cloud platforms (AWS or GCP). Statistics background preferred."

Expected output:
{
  "score": 5,
  "justification": "Jane has strong Python and statistics fundamentals, plus 5 years of data experience total. However, she lacks ML deployment experience, Spark, and any cloud platform skills, which are core requirements for this senior role.",
  "matched_skills": ["Python", "SQL", "Pandas", "scikit-learn", "Statistics background"],
  "missing_skills": ["ML model deployment", "Spark", "AWS", "GCP", "5+ years seniority"]
}
```

---

## Setup & Running Locally

> **Prerequisites**: Node.js 18 or later and npm 9 or later (bundled with Node 18+). All commands use `npm` — do not mix with `yarn` or `pnpm` to avoid lockfile conflicts.

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd smart-resume-screener
```

### 2. Database Setup
1. Create a free project at [supabase.com](https://supabase.com) (no credit card required).
2. Once your project is ready, go to **SQL Editor** in the Supabase dashboard.
3. Paste the full contents of `supabase/schema.sql` into the editor and click **Run**.

This will provision three tables:
- **`job_descriptions`** — Stores job titles and requirements text.
- **`resumes`** — Stores filename, raw text, and structured profile JSON. Includes a `job_description_id` foreign key (`references job_descriptions(id) ON DELETE CASCADE`) so that every resume is permanently scoped to the job it was uploaded for — not a shared global pool. Switching to a different job description only shows candidates uploaded for that specific role.
- **`scores`** — Stores computed scores, justifications, matched skills, and missing skills for each resume/job pair.

### 3. Environment Configuration
Copy the template to create a local environment file:
```bash
cp .env.example .env.local
```

Fill in the credentials in `.env.local`:

| Variable | How to get it |
|---|---|
| `GROQ_API_KEY` | Go to [console.groq.com](https://console.groq.com), sign up, go to **API Keys**, and create a new key. No credit card required. |
| `NEXT_PUBLIC_SUPABASE_URL` | Found in your Supabase project under **Settings ? API ? Project URL**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Found under **Settings ? API ? anon** public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Found under **Settings ? API ? service_role** secret key. Used server-side only to bypass Row Level Security for writes. Never expose this in client-side code. |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL, e.g. `https://smart-resume-screener-seven.vercel.app` (use `http://localhost:3000` locally). |

### 4. Install Dependencies
```bash
npm install
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## Testing & Verifying

Unit tests verify parsing, validation retries, and scoring logic.

Run the test suite:
```bash
npm test
```

Check TypeScript compilation:
```bash
npm run type-check
```

---

## Data Model: Job-Scoped Resumes

By design, candidate resumes are scoped directly to a specific job description (`job_description_id` column in the `resumes` table).
- This matches a real-world recruiting workflow, where candidates apply to a specific open requisition rather than a global pool scored against arbitrary jobs.
- Selecting a saved job description instantly filters the candidates to only show those uploaded for that specific role.
- Uploads are disabled until a job description is active to prevent orphaned candidate records.

---

## Known Limitations

- **Scanned Resumes**: The PDF text extractor runs entirely in memory without OCR. Scanned/image-only PDFs will fail with an extraction warning. Resumes must contain extractable text characters.
- **API Call Timeouts**: Scoring is performed sequentially. In production environments with a high volume of resumes, serverless function timeouts (typically 10s on Vercel Hobby plan) can be triggered. For larger batches, this should be refactored into a background worker queue.
- **Tokens/Cost**: Running two-stage LLM extraction and scoring calls on every upload accumulates token usage. The app mitigates this by storing structured JSON in Supabase so scoring can be run and adjusted without re-extracting resume structures.
- **Groq Free-Tier Rate Limits**: Groq's free tier enforces per-minute limits (approximately 30 requests/min and 6,000 tokens/min on `llama-3.3-70b-versatile`). When scoring multiple candidates in one batch, the app introduces a small sequential delay between Groq calls to stay within these limits. If you hit a rate-limit error, wait 60 seconds and retry.
