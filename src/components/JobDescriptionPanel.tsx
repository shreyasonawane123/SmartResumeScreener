"use client";

// ============================================================
// components/JobDescriptionPanel.tsx
//
// Left panel layout. Contains title input, description textarea,
// threshold slider/number input, and saved job descriptions dropdown.
// Triggers job description submission and scores calculation.
// ============================================================

import { useState, useEffect } from "react";
import type { StoredJobDescription } from "@/lib/types";

interface JobDescriptionPanelProps {
  threshold: number;
  onThresholdChange: (t: number) => void;
  onAnalyze: (jobId: string) => Promise<void>;
  isAnalyzing: boolean;
  onSetError: (err: string | null) => void;
}

export function JobDescriptionPanel({
  threshold,
  onThresholdChange,
  onAnalyze,
  isAnalyzing,
  onSetError,
}: JobDescriptionPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [savedJobs, setSavedJobs] = useState<StoredJobDescription[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Fetch saved job descriptions on mount
  useEffect(() => {
    async function fetchJobs() {
      setIsLoadingJobs(true);
      try {
        const res = await fetch("/api/job-descriptions");
        const json = await res.json();
        if (json.data) {
          setSavedJobs(json.data);
        }
      } catch (err) {
        console.error("Failed to load saved jobs:", err);
      } finally {
        setIsLoadingJobs(false);
      }
    }
    fetchJobs();
  }, []);

  // Handle job description selection from dropdown
  const handleSelectSavedJob = (id: string) => {
    setSelectedJobId(id);
    if (!id) {
      setTitle("");
      setDescription("");
      return;
    }
    const job = savedJobs.find((j) => j.id === id);
    if (job) {
      setTitle(job.title);
      setDescription(job.description_text);
    }
  };

  // Submit and analyze
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      onSetError("Please enter both a job title and description.");
      return;
    }
    onSetError(null);

    try {
      // Step 1: Save the Job Description
      const res = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description_text: description,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to save job description.");
      }

      const savedJob = json.data as StoredJobDescription;

      // Update saved jobs dropdown
      setSavedJobs((prev) => [savedJob, ...prev.filter((j) => j.id !== savedJob.id)]);
      setSelectedJobId(savedJob.id);

      // Step 2: Trigger scoring for all resumes
      await onAnalyze(savedJob.id);
    } catch (err) {
      onSetError(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  return (
    <div className="card p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Job Details</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Enter details or load a saved job description to score against.
        </p>
      </div>

      {/* Saved Jobs Selector */}
      {savedJobs.length > 0 && (
        <div>
          <label className="label">Load Saved Job</label>
          <select
            className="input-base text-xs bg-[var(--bg-input)] cursor-pointer"
            value={selectedJobId}
            onChange={(e) => handleSelectSavedJob(e.target.value)}
            disabled={isAnalyzing}
          >
            <option value="">-- Create New / Select saved --</option>
            {savedJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} ({new Date(job.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title Input */}
        <div>
          <label className="label" htmlFor="job-title">
            Job Title
          </label>
          <input
            id="job-title"
            className="input-base"
            type="text"
            placeholder="e.g. Senior Frontend Architect"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isAnalyzing}
            required
          />
        </div>

        {/* Description Textarea */}
        <div>
          <label className="label" htmlFor="job-description">
            Job Description
          </label>
          <textarea
            id="job-description"
            className="input-base min-h-[220px] text-xs font-mono"
            placeholder="Paste raw job description, candidate requirements, tech stack details, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isAnalyzing}
            required
          />
        </div>

        {/* Shortlisting Threshold */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="label !mb-0" htmlFor="threshold-slider">
              Shortlist Threshold
            </label>
            <span className="text-xs font-bold text-[var(--gold)]">
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
              className="flex-1 h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-bright)]"
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
              className="w-12 text-center p-1 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] text-[var(--text-primary)] font-semibold"
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
            Adjusting threshold updates the shortlisted list instantly on the right.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          className="btn-primary mt-2"
          disabled={isAnalyzing || !title.trim() || !description.trim()}
        >
          {isAnalyzing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing & Scoring...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                />
              </svg>
              Analyze & Score Candidates
            </>
          )}
        </button>
      </form>
    </div>
  );
}
