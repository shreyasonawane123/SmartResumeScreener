"use client";

// ============================================================
// app/page.tsx
//
// Root dashboard layout. Features a beautiful split-view:
// - Left: Job details form + resume uploader
// - Right: Live score results split into Shortlisted vs Others
// ============================================================

import { useState, useEffect } from "react";
import { JobDescriptionPanel } from "@/components/JobDescriptionPanel";
import { ResumeUploader } from "@/components/ResumeUploader";
import { CandidateList } from "@/components/CandidateList";
import { ProgressStepper } from "@/components/ProgressStepper";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DEFAULT_SHORTLIST_THRESHOLD } from "@/lib/constants";
import type { CandidateScore, StoredResume, ProcessingStep } from "@/lib/types";

export default function Home() {
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [candidates, setCandidates] = useState<CandidateScore[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_SHORTLIST_THRESHOLD);

  // Error and Loading/Pipeline States
  const [error, setError] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<ProcessingStep>("idle");
  const [activeFilename, setActiveFilename] = useState<string>("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Load existing resumes from database on mount
  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch("/api/resumes");
        const json = await res.json();
        if (json.data) {
          setResumes(json.data);
        }
      } catch (err) {
        console.error("Failed to load existing resumes:", err);
      }
    }
    loadResumes();
  }, []);

  // Handle new resume upload successes
  const handleUploadSuccess = (newResumes: StoredResume[]) => {
    setResumes((prev) => {
      // Deduplicate by filename
      const filtered = prev.filter((r) => !newResumes.some((nr) => nr.filename === r.filename));
      return [...newResumes, ...filtered];
    });
  };

  // Run the full LLM scoring workflow
  const handleAnalyze = async (jobId: string) => {
    if (resumes.length === 0) {
      setError("Please upload at least one resume on the left first.");
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
      if (!res.ok || json.error) {
        throw new Error(json.error || "Analysis pipeline failed during scoring.");
      }

      setCandidates(json.data || []);
      setPipelineStep("done");

      // Reset step to idle after a few seconds of visual completion
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
      {/* Premium Header bar */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] py-4 px-6 md:px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--accent)] to-[#6d28d9] flex items-center justify-center font-bold text-white shadow-[0_0_12px_var(--accent-glow)]">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              SmartResume Screener
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium">
              Vercel Serverless Core • Claude 3.5 Sonnet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-secondary)] hidden sm:inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            Supabase connected
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs font-semibold border border-[var(--border)] rounded-md px-2.5 py-1"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main split-view dashboard */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column (Job Inputs & Uploads) — Col 5 */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <JobDescriptionPanel
            threshold={threshold}
            onThresholdChange={setThreshold}
            onAnalyze={handleAnalyze}
            isAnalyzing={isLoadingCandidates}
            onSetError={setError}
          />

          <ResumeUploader
            onUploadSuccess={handleUploadSuccess}
            onSetError={setError}
            existingResumeCount={resumes.length}
          />
        </section>

        {/* Right column (Results List) — Col 7 */}
        <section className="lg:col-span-7 flex flex-col">
          {/* Global Pipeline Error message */}
          <ErrorBanner message={error} onClear={() => setError(null)} />

          {/* Active processing step feedback */}
          <ProgressStepper step={pipelineStep} filename={activeFilename} />

          {/* Candidate Lists */}
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide uppercase">
                Ranking Results
              </h2>
              {candidates.length > 0 && (
                <span className="text-xs text-[var(--text-secondary)]">
                  Sorted by Score (Descending)
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
