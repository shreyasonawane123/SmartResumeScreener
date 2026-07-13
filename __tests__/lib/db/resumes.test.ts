// ============================================================
// __tests__/lib/db/resumes.test.ts
//
// Unit tests for the scoped resume DB functions.
// Supabase client is mocked — no live DB or LLM calls.
// ============================================================

import { getResumesByJobDescription, insertResume, DbError } from "@/lib/db/resumes";

// Mock the Supabase client module
jest.mock("@/lib/db/client", () => ({
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from "@/lib/db/client";

const JOB_ID_A = "job-a-uuid-1111";

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

// Helper mock builder that supports chainable queries and acts as a Thenable promise.
function makeMockClient(resolvedValues: {
  checkValue?: { data: any; error: any };
  insertValue?: { data: any; error: any };
  updateValue?: { data: any; error: any };
  selectValue?: { data: any; error: any };
}) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((onFulfilled) => {
      let val = { data: [], error: null };
      if (chain.insert.mock.calls.length > 0) {
        val = resolvedValues.insertValue || { data: null, error: null };
      } else if (chain.update.mock.calls.length > 0) {
        val = resolvedValues.updateValue || { data: null, error: null };
      } else if (chain.order.mock.calls.length > 0) {
        val = resolvedValues.selectValue || { data: [], error: null };
      } else {
        val = resolvedValues.checkValue || { data: [], error: null };
      }
      return Promise.resolve(val).then(onFulfilled);
    }),
  };

  return chain;
}

describe("getResumesByJobDescription", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns only resumes that belong to the requested job", async () => {
    const client = makeMockClient({ selectValue: { data: [resumeA1], error: null } });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await getResumesByJobDescription(JOB_ID_A);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("alice.pdf");
    expect(client.eq).toHaveBeenCalledWith("job_description_id", JOB_ID_A);
  });

  it("throws DbError when Supabase returns an error", async () => {
    const client = makeMockClient({ selectValue: { data: null, error: { message: "refused" } } });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await expect(getResumesByJobDescription(JOB_ID_A)).rejects.toThrow(DbError);
  });
});

describe("insertResume", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts new resume if none exists with same name", async () => {
    const client = makeMockClient({
      checkValue: { data: [], error: null }, // no existing record
      insertValue: { data: resumeA1, error: null },
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await insertResume({
      job_description_id: JOB_ID_A,
      filename: "alice.pdf",
      raw_text: "Alice resume text",
      structured_json: resumeA1.structured_json,
    });

    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_description_id: JOB_ID_A, filename: "alice.pdf" }),
    );
    expect(result.filename).toBe("alice.pdf");
  });

  it("updates existing resume if record already exists", async () => {
    const client = makeMockClient({
      checkValue: { data: [{ id: "resume-a1" }], error: null }, // existing record found
      updateValue: { data: resumeA1, error: null },
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await insertResume({
      job_description_id: JOB_ID_A,
      filename: "alice.pdf",
      raw_text: "Updated text",
      structured_json: resumeA1.structured_json,
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ raw_text: "Updated text" }),
    );
    expect(client.eq).toHaveBeenCalledWith("id", "resume-a1");
    expect(result.id).toBe("resume-a1");
  });

  it("cleans up duplicates and updates the first one if multiple exist", async () => {
    const client = makeMockClient({
      checkValue: { data: [{ id: "resume-a1" }, { id: "resume-a2-dup" }], error: null }, // duplicates found
      updateValue: { data: resumeA1, error: null },
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await insertResume({
      job_description_id: JOB_ID_A,
      filename: "alice.pdf",
      raw_text: "Updated text",
      structured_json: resumeA1.structured_json,
    });

    expect(client.delete).toHaveBeenCalled();
    expect(client.in).toHaveBeenCalledWith("id", ["resume-a2-dup"]);
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ raw_text: "Updated text" }),
    );
    expect(result.id).toBe("resume-a1");
  });

  it("throws DbError when check fails", async () => {
    const client = makeMockClient({
      checkValue: { data: null, error: { message: "query block" } },
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

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
