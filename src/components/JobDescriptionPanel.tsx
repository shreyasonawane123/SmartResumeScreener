"use client";

// ============================================================
// components/JobDescriptionPanel.tsx
//
// Fix: if the user selects a saved job and hasn't edited the
// title/description, skip the POST and reuse the existing
// job_description_id directly. This prevents a new DB row
// from being created on every "Analyse & Score" click.
//
// Also deduplicates the dropdown by title so old DB duplicates
// don't clutter the list.
// ============================================================

import { useState, useEffect } from "react";
import type { StoredJobDescription } from "@/lib/types";

interface JobDescriptionPanelProps {
  threshold: number;
  onThresholdChange: (t: number) => void;
  onAnalyze: (jobId: string) => Promise<void>;
  /** Called whenever a job description becomes active (selected or newly saved). */
  onJobReady: (jobId: string) => void;
  isAnalyzing: boolean;
  onSetError: (err: string | null) => void;
}

export function JobDescriptionPanel({
  threshold,
  onThresholdChange,
  onAnalyze,
  onJobReady,
  isAnalyzing,
  onSetError,
}: JobDescriptionPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [savedJobs, setSavedJobs] = useState<StoredJobDescription[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Track whether the user has edited the form after loading a saved job.
  // When false + a job is selected, we reuse the existing ID without re-saving.
  const [isDirty, setIsDirty] = useState(false);

  // Fetch saved job descriptions on mount
  useEffect(() => {
    async function fetchJobs() {
      setIsLoadingJobs(true);
      try {
        const res = await fetch("/api/job-descriptions");
        const json = await res.json();
        if (json.data) {
          // Deduplicate by title — keep only the most-recent entry per title
          // so old DB duplicates don't pollute the dropdown.
          const seen = new Set<string>();
          const deduped: StoredJobDescription[] = [];
          for (const job of json.data as StoredJobDescription[]) {
            const key = job.title.trim().toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(job);
            }
          }
          setSavedJobs(deduped);
        }
      } catch (err) {
        console.error("Failed to load saved jobs:", err);
      } finally {
        setIsLoadingJobs(false);
      }
    }
    fetchJobs();
  }, []);

  // Load a saved job into the form and notify parent
  const handleSelectSavedJob = (id: string) => {
    setSelectedJobId(id);
    setIsDirty(false);
    if (!id) {
      setTitle("");
      setDescription("");
      onJobReady(""); // job deselected
      return;
    }
    const job = savedJobs.find((j) => j.id === id);
    if (job) {
      setTitle(job.title);
      setDescription(job.description_text);
      onJobReady(id); // notify parent immediately on selection
    }
  };

  // Mark form dirty when user edits title or description
  const handleTitleChange = (v: string) => {
    setTitle(v);
    setIsDirty(true);
  };

  const handleDescriptionChange = (v: string) => {
    setDescription(v);
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      onSetError("Please enter both a job title and description.");
      return;
    }
    onSetError(null);

    try {
      // ── Reuse existing job if selected and not edited ──
      if (selectedJobId && !isDirty) {
        await onAnalyze(selectedJobId);
        return;
      }

      // ── Otherwise save a new job description ──
      const res = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description_text: description }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to save job description.");

      const savedJob = json.data as StoredJobDescription;

      // Add to dropdown (deduplicated by title)
      setSavedJobs((prev) => {
        const filtered = prev.filter(
          (j) => j.title.trim().toLowerCase() !== savedJob.title.trim().toLowerCase(),
        );
        return [savedJob, ...filtered];
      });
      setSelectedJobId(savedJob.id);
      setIsDirty(false);
      onJobReady(savedJob.id); // notify parent of new active job

      await onAnalyze(savedJob.id);
    } catch (err) {
      onSetError(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  return (
    <div className="card p-0 flex flex-col overflow-hidden">
      {/* ── Case-file cover sheet header ── */}
      <div
        className="px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}
      >
        <p
          className="text-[9px] tracking-widest uppercase mb-0.5"
          style={{ color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}
        >
          Case File — Job Specification
        </p>
        <h2
          className="text-sm font-bold tracking-tight"
          style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}
        >
          Job Details
        </h2>
        <p
          className="text-[10px] mt-0.5"
          style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Enter details or load a saved job description to score against.
        </p>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        {/* ── Load Saved Job ── */}
        {savedJobs.length > 0 && (
          <div>
            <label className="field-label" htmlFor="saved-job-select">
              Load Saved Job
            </label>
            <select
              id="saved-job-select"
              className="input-base text-[11px] cursor-pointer"
              value={selectedJobId}
              onChange={(e) => handleSelectSavedJob(e.target.value)}
              disabled={isAnalyzing}
            >
              <option value="">— Create new —</option>
              {savedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}{" "}
                  ({new Date(job.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* ── SUBJECT field ── */}
          <div>
            <label className="field-label" htmlFor="job-title">
              Subject / Role Title
            </label>
            <input
              id="job-title"
              className="input-base"
              type="text"
              placeholder="e.g. Senior Backend Engineer"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isAnalyzing}
              required
            />
          </div>

          {/* ── REQUIREMENTS field ── */}
          <div>
            <label className="field-label" htmlFor="job-description">
              Requirements
            </label>
            <textarea
              id="job-description"
              className="input-base min-h-[200px] text-[11px]"
              placeholder="Paste raw job description, candidate requirements, tech stack details, etc."
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              disabled={isAnalyzing}
              required
            />
          </div>

          {/* ── Shortlisting Threshold ── */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="field-label !mb-0" htmlFor="threshold-slider">
                Shortlist Threshold
              </label>
              <span
                className="text-[10px] font-bold"
                style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Score ≥ {threshold.toFixed(0)} / 10
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="threshold-slider"
                type="range"
                min={1}
                max={10}
                step={1}
                value={threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                disabled={isAnalyzing}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "var(--text-primary)" }}
              />
              <input
                type="number"
                min={1}
                max={10}
                value={threshold}
                onChange={(e) =>
                  onThresholdChange(Math.max(1, Math.min(10, Number(e.target.value))))
                }
                disabled={isAnalyzing}
                className="w-11 text-center p-1 text-[11px] border rounded"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  borderColor: "var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <p
              className="text-[9px] mt-1.5 leading-relaxed"
              style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Adjusting threshold updates the shortlisted column instantly.
            </p>
          </div>

          {/* ── Action Button ── */}
          <button
            type="submit"
            className="btn-primary mt-1"
            disabled={isAnalyzing || !title.trim() || !description.trim()}
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analysing &amp; Scoring…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
                {selectedJobId && !isDirty ? "Re-Score with Saved Job" : "Analyse & Score Candidates"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
