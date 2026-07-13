// ============================================================
// lib/schemas.ts
//
// Zod schemas that mirror the TypeScript types in lib/types.ts.
// These are used at runtime to validate LLM JSON output before
// saving to the DB. If validation fails, we retry the LLM call
// with the error message appended to the prompt.
// ============================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Resume extraction schema
// ---------------------------------------------------------------------------

export const ExperienceSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  years: z.number().min(0).max(60),
});

export const EducationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
});

export const ResumeDataSchema = z.object({
  name: z.string().min(1, "Candidate name is required"),
  skills: z.array(z.string().min(1)).min(0),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
});

export type ResumeDataInput = z.infer<typeof ResumeDataSchema>;

// ---------------------------------------------------------------------------
// Scoring schema
// ---------------------------------------------------------------------------

export const ScoreResultSchema = z.object({
  score: z
    .number()
    .min(1, "Score must be at least 1")
    .max(10, "Score cannot exceed 10"),
  justification: z.string().min(10, "Justification must be at least 10 characters"),
  matched_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
});

export type ScoreResultInput = z.infer<typeof ScoreResultSchema>;

// ---------------------------------------------------------------------------
// Job description schema (for API request validation)
// ---------------------------------------------------------------------------

export const JobDescriptionSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  description_text: z.string().min(20, "Job description must be at least 20 characters"),
});
