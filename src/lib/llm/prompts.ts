// ============================================================
// lib/llm/prompts.ts
//
// The two LLM prompts used by this app, with inline comments
// explaining the design choices. Written to be readable and
// explainable in an interview, not auto-generated boilerplate.
//
// DESIGN PHILOSOPHY
// Two separate prompts instead of one combined prompt because:
// 1. Extraction and scoring are different cognitive tasks —
//    combining them makes each one harder for the model.
// 2. Extraction runs once per resume; scoring can be re-run
//    against different job descriptions without re-extracting.
// 3. Separate prompts are easier to test and improve in isolation.
// ============================================================

// ---------------------------------------------------------------------------
// PROMPT 1: EXTRACTION
//
// Goal: convert raw resume text into structured JSON.
//
// Design choices:
// - System role is "resume parser", not generic assistant.
//   Giving the model a narrow job description improves focus.
// - Explicit output schema in the prompt prevents the model from
//   inventing fields or nesting things differently.
// - One worked example (few-shot) shows the expected format concretely.
//   Without an example, models often get "years" wrong (string vs number).
// - "Reason step-by-step internally, then emit ONLY the final JSON."
//   Chain-of-thought internally + silent output keeps the response clean
//   for Zod validation. We're using tool_use so the model is forced to
//   emit a typed object anyway, but the instruction reinforces it.
// ---------------------------------------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `You are a resume parser. Your job is to extract structured information from resume text.

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
}`;

export const EXTRACTION_USER_PROMPT = (resumeText: string) =>
  `Extract structured data from this resume:\n\n---\n${resumeText}\n---`;

// ---------------------------------------------------------------------------
// PROMPT 2: SCORING
//
// Goal: rate how well a candidate's extracted resume data matches
//       a given job description, and explain why.
//
// Design choices:
// - Input is the structured JSON (not raw text) because extraction
//   already did the parsing work. Passing structured data makes it
//   easier for the model to compare skills systematically.
// - Canonical instruction mirrors the spec: "Compare the following
//   resume with this job description and rate fit on 1–10."
// - Score scale 1–10 is explicit in the output schema so the model
//   doesn't return 0, 11, or percentages.
// - matched_skills and missing_skills are required outputs because
//   they drive the UI — the card shows skill chips, not just a score.
// - One worked example grounds the expected format and score calibration.
//   Without this, different runs give wildly different score distributions.
// - Chain-of-thought internally keeps the justification field clean
//   (final verdict prose only, not internal reasoning).
// ---------------------------------------------------------------------------

export const SCORING_SYSTEM_PROMPT = `You are a technical recruiter scoring how well a candidate fits a job description.

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
}`;

export const SCORING_USER_PROMPT = (
  resumeJson: object,
  jobDescription: string,
) => `Compare the following resume with this job description and rate fit on 1-10 with justification.

Candidate resume (structured):
${JSON.stringify(resumeJson, null, 2)}

Job description:
${jobDescription}`;
