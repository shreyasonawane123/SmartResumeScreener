"use client";

// ============================================================
// components/CandidateList.tsx
// Passes isShortlisted flag to each CandidateCard so the stamp
// only appears on the shortlisted group.
// ============================================================

import type { CandidateScore } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";

interface CandidateListProps {
  candidates: CandidateScore[];
  threshold: number;
  isLoading: boolean;
}

export function CandidateList({ candidates, threshold, isLoading }: CandidateListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="card-folder p-5 flex items-start gap-4 animate-pulse-soft"
          >
            <div
              className="w-14 h-14 rounded-full shrink-0"
              style={{ background: "var(--bg-surface)" }}
            />
            <div className="flex-1 space-y-2 mt-2">
              <div className="h-3 rounded w-1/3" style={{ background: "var(--bg-surface)" }} />
              <div className="h-2.5 rounded w-2/3" style={{ background: "var(--bg-surface)" }} />
              <div className="h-2 rounded w-1/2" style={{ background: "var(--bg-surface)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div
        className="card p-10 flex flex-col items-center justify-center text-center"
        style={{ borderStyle: "dashed", borderColor: "var(--border)" }}
      >
        {/* File/folder icon */}
        <svg
          className="w-10 h-10 mb-4"
          style={{ color: "var(--text-muted)", opacity: 0.55 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "#171512", fontFamily: "'Inter', sans-serif" }}
        >
          No Dossiers Scored
        </h3>
        <p
          className="text-[10px] max-w-[260px] leading-relaxed"
          style={{ color: "#4A443C", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Upload candidate resumes and fill in the job details on the left, then click
          “Analyse & Score” to begin ranking.
        </p>
      </div>
    );
  }

  const sorted = [...candidates].sort((a, b) => b.score_result.score - a.score_result.score);
  const shortlisted = sorted.filter((c) => c.score_result.score >= threshold);
  const otherCandidates = sorted.filter((c) => c.score_result.score < threshold);

  return (
    <div className="space-y-6">
      {shortlisted.length > 0 && (
        <div className="space-y-3">
          <div className="section-header-shortlisted">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>▮</span>
            Shortlisted — {shortlisted.length} candidate{shortlisted.length !== 1 ? "s" : ""}
          </div>
          <div className="space-y-3">
            {shortlisted.map((candidate) => (
              <CandidateCard
                key={candidate.score_id}
                candidate={candidate}
                isShortlisted={true}
              />
            ))}
          </div>
        </div>
      )}

      {otherCandidates.length > 0 && (
        <div className="space-y-3">
          <div className="section-header-other">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>↳</span>
            Not Shortlisted Candidates
          </div>
          <div className="space-y-3">
            {otherCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.score_id}
                candidate={candidate}
                isShortlisted={false}
              />
            ))}
          </div>
        </div>
      )}

      {shortlisted.length === 0 && otherCandidates.length === 0 && (
        <div
          className="text-center py-4 text-[10px] font-mono"
          style={{ color: "#4A443C" }}
        >
          No candidates match the scoring criteria.
        </div>
      )}
    </div>
  );
}
