// ============================================================
// __tests__/lib/db/resumes.test.ts
//
// Unit tests for the scoped resume DB functions.
// Supabase client is mocked — no live DB or LLM calls.
//
// Tests:
// - getResumesByJobDescription: returns only matching rows
// - getResumesByJobDescription: returns [] when no rows match
// - getResumesByJobDescription: throws DbError on DB failure
// - insertResume: passes job_description_id to the insert call
// ============================================================

import { getResumesByJobDescription, insertResume, DbError } from "@/lib/db/resumes";

// Mock the Supabase client module
jest.mock("@/lib/db/client", () => ({
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from "@/lib/db/client";

// ── Shared fixture data ──────────────────────────────────────

const JOB_ID_A = "job-a-uuid-1111";
const JOB_ID_B = "job-b-uuid-2222";

const resumeA1 = {
  id: "resume-a1",
  job_description_id: JOB_ID_A,
  filename: "alice.pdf",
  raw_text: "Alice resume text",
  structured_json: {
    name: "Alice",
    skills: ["TypeScript"],
    experience: [],
    education: [],
  },
  created_at: "2026-01-01T00:00:00Z",
};

const resumeA2 = {
  id: "resume-a2",
  job_description_id: JOB_ID_A,
  filename: "bob.pdf",
  raw_text: "Bob resume text",
  structured_json: {
    name: "Bob",
    skills: ["Python"],
    experience: [],
    education: [],
  },
  created_at: "2026-01-02T00:00:00Z",
};

// ── Supabase query builder mock factory ─────────────────────

function makeQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    // For non-.single() calls the terminal call is .order()
    then: undefined as unknown,
  };
  // Make .order() resolve the promise (used by getResumesByJobDescription)
  builder.order = jest.fn().mockResolvedValue(resolvedValue);
  return builder;
}

// ── Tests ────────────────────────────────────────────────────

describe("getResumesByJobDescription", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns only resumes that belong to the requested job", async () => {
    const builder = makeQueryBuilder({ data: [resumeA1, resumeA2], error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    const result = await getResumesByJobDescription(JOB_ID_A);

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe("alice.pdf");
    expect(result[1].filename).toBe("bob.pdf");
    // Confirm the .eq filter was applied with the correct job ID
    expect(builder.eq).toHaveBeenCalledWith("job_description_id", JOB_ID_A);
  });

  it("returns an empty array when no resumes exist for the job", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    const result = await getResumesByJobDescription(JOB_ID_B);

    expect(result).toEqual([]);
    expect(builder.eq).toHaveBeenCalledWith("job_description_id", JOB_ID_B);
  });

  it("returns an empty array when data is null (no rows)", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    const result = await getResumesByJobDescription(JOB_ID_A);
    expect(result).toEqual([]);
  });

  it("throws DbError when Supabase returns an error", async () => {
    const builder = makeQueryBuilder({
      data: null,
      error: { message: "connection refused" },
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    await expect(getResumesByJobDescription(JOB_ID_A)).rejects.toThrow(DbError);
    await expect(getResumesByJobDescription(JOB_ID_A)).rejects.toThrow(
      "Failed to fetch resumes for job",
    );
  });
});

describe("insertResume", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes job_description_id to the insert call", async () => {
    const builder = makeQueryBuilder({ data: resumeA1, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    const result = await insertResume({
      job_description_id: JOB_ID_A,
      filename: "alice.pdf",
      raw_text: "Alice resume text",
      structured_json: resumeA1.structured_json,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_description_id: JOB_ID_A }),
    );
    expect(result.filename).toBe("alice.pdf");
  });

  it("throws DbError when insert fails", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "unique violation" } });
    (getSupabaseClient as jest.Mock).mockReturnValue(builder);

    await expect(
      insertResume({
        job_description_id: JOB_ID_A,
        filename: "alice.pdf",
        raw_text: "text",
        structured_json: resumeA1.structured_json,
      }),
    ).rejects.toThrow(DbError);
  });
});
