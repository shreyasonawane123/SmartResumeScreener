"use client";

// ============================================================
// components/CandidateList.tsx
//
// Ranked candidates rendering container.
// Splits the list into "Shortlisted" (score >= threshold) and
// "Other Candidates" (score < threshold) based on the configurable
// threshold, both sorted by score descending.
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
            className="card p-5 flex items-start gap-4 animate-pulse-soft border-[var(--border)]"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] shrink-0" />
            <div className="flex-1 space-y-2 mt-2">
              <div className="h-4 bg-[var(--bg-surface)] rounded w-1/3" />
              <div className="h-3 bg-[var(--bg-surface)] rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center border-dashed border-[var(--border)]">
        <svg
          className="w-12 h-12 text-[var(--text-muted)] mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">No Resumes Scored Yet</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[280px]">
          Upload resumes and save a job description on the left, then click "Analyze & Score" to begin.
        </p>
      </div>
    );
  }

  // Filter and sort candidates (though API already returns sorted, client-side safety sort)
  const sorted = [...candidates].sort((a, b) => b.score_result.score - a.score_result.score);
  const shortlisted = sorted.filter((c) => c.score_result.score >= threshold);
  const otherCandidates = sorted.filter((c) => c.score_result.score < threshold);

  return (
    <div className="space-y-6">
      {/* Shortlisted Candidates */}
      {shortlisted.length > 0 && (
        <div className="space-y-3">
          <div className="section-header-shortlisted">
            <span className="text-sm font-semibold">★</span> Shortlisted Candidates ({shortlisted.length})
          </div>
          <div className="space-y-3">
            {shortlisted.map((candidate) => (
              <CandidateCard key={candidate.score_id} candidate={candidate} />
            ))}
          </div>
        </div>
      )}

      {/* Other Candidates */}
      {otherCandidates.length > 0 && (
        <div className="space-y-3">
          <div className="section-header-other">
            <span>↳</span> Other Candidates ({otherCandidates.length})
          </div>
          <div className="space-y-3">
            {otherCandidates.map((candidate) => (
              <CandidateCard key={candidate.score_id} candidate={candidate} />
            ))}
          </div>
        </div>
      )}

      {shortlisted.length === 0 && otherCandidates.length === 0 && (
        <div className="text-center text-xs text-[var(--text-muted)] py-4">
          No candidates match the scoring requirements.
        </div>
      )}
    </div>
  );
}
