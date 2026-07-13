"use client";

// ============================================================
// app/page.tsx — Candidate Dossier layout
//
// activeJobId is lifted here so ResumeUploader can be gated
// (disabled until a job is selected) and candidates can be
// refreshed when the active job changes.
// ============================================================

import { useState } from "react";
import { JobDescriptionPanel } from "@/components/JobDescriptionPanel";
import { ResumeUploader } from "@/components/ResumeUploader";
import { CandidateList } from "@/components/CandidateList";
import { ProgressStepper } from "@/components/ProgressStepper";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DEFAULT_SHORTLIST_THRESHOLD } from "@/lib/constants";
import type { CandidateScore, StoredResume, ProcessingStep } from "@/lib/types";

export default function Home() {
  // The currently active job description ID.
  // Set when user saves a new job OR selects one from the dropdown.
  // ResumeUploader is disabled until this is non-empty.
  const [activeJobId, setActiveJobId] = useState<string>("");

  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [candidates, setCandidates] = useState<CandidateScore[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_SHORTLIST_THRESHOLD);

  const [error, setError] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<ProcessingStep>("idle");
  const [activeFilename, setActiveFilename] = useState<string>("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Called by JobDescriptionPanel whenever a job becomes active
  // (either newly saved or selected from dropdown).
  // Clears the candidate list so stale results from a previous job don't linger.
  const handleJobReady = (jobId: string) => {
    if (jobId !== activeJobId) {
      setActiveJobId(jobId);
      setResumes([]);      // clear resumes — they belong to a different job
      setCandidates([]);   // clear results — they were for a different job
      setError(null);
    }
  };

  const handleUploadSuccess = (newResumes: StoredResume[]) => {
    setResumes((prev) => {
      const filtered = prev.filter((r) => !newResumes.some((nr) => nr.filename === r.filename));
      return [...newResumes, ...filtered];
    });
  };

  const handleAnalyze = async (jobId: string) => {
    if (resumes.length === 0) {
      setError("Please upload at least one resume for this job description first.");
      return;
    }
    setIsLoadingCandidates(true);
    setPipelineStep("scoring");
    setError(null);

    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description_id: jobId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Analysis pipeline failed.");
      setCandidates(json.data || []);
      setPipelineStep("done");
      setTimeout(() => setPipelineStep("idle"), 3000);
    } catch (err) {
      setPipelineStep("error");
      setError(err instanceof Error ? err.message : "Pipeline failed.");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header
        className="border-b py-3 px-6 md:px-10 flex justify-between items-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div>
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", letterSpacing: "0.2em" }}
          >
            SmartResume Screener
          </span>
          <span
            className="ml-3 text-[10px] tracking-widest uppercase"
            style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Candidate Dossier System
          </span>
        </div>

        <div className="flex items-center gap-5">
          <span
            className="text-[10px] hidden sm:inline-flex items-center gap-1.5 font-mono tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            LIVE — GROQ LLM
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-[10px] px-3 py-1.5"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* ── Main split-view ── */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <JobDescriptionPanel
            threshold={threshold}
            onThresholdChange={setThreshold}
            onAnalyze={handleAnalyze}
            onJobReady={handleJobReady}
            isAnalyzing={isLoadingCandidates}
            onSetError={setError}
          />
          <ResumeUploader
            jobDescriptionId={activeJobId}
            onUploadSuccess={handleUploadSuccess}
            onSetError={setError}
            existingResumeCount={resumes.length}
          />
        </section>

        {/* Right column */}
        <section className="lg:col-span-7 flex flex-col">
          <ErrorBanner message={error} onClear={() => setError(null)} />
          <ProgressStepper step={pipelineStep} filename={activeFilename} />

          <div className="space-y-4">
            <div
              className="flex justify-between items-center pb-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2
                className="text-[11px] font-bold tracking-widest uppercase"
                style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}
              >
                Ranking Results
              </h2>
              {candidates.length > 0 && (
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {candidates.length} file{candidates.length !== 1 ? "s" : ""} scored — descending
                </span>
              )}
            </div>

            <CandidateList
              candidates={candidates}
              threshold={threshold}
              isLoading={isLoadingCandidates}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
