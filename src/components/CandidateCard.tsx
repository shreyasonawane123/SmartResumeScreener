"use client";

// ============================================================
// components/CandidateCard.tsx
//
// Represents a single candidate. Shows name, score ring,
// a short one-line summary, and contains an expandable section
// containing the full justification and matched/missing skill chips.
// ============================================================

import { useState } from "react";
import type { CandidateScore } from "@/lib/types";
import { ScoreGauge } from "./ScoreGauge";
import { SkillChip } from "./SkillChip";

interface CandidateCardProps {
  candidate: CandidateScore;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { resume, score_result } = candidate;
  const { name, skills, experience, education } = resume.structured_json;
  const { score, justification, matched_skills, missing_skills } = score_result;

  // Derive a one-line summary from the justification (first sentence or first 80 chars)
  const firstSentence = justification.split(/[.!?]/)[0];
  const summaryLine = firstSentence ? `${firstSentence}.` : justification;

  // Calculate total years of experience
  const totalYears = experience.reduce((sum, exp) => sum + (exp.years || 0), 0);
  const primaryRole = experience[0]?.role || "Profession unspecified";
  const primaryCompany = experience[0]?.company ? `@ ${experience[0].company}` : "";

  return (
    <div className="card overflow-hidden hover:bg-[var(--bg-card-hover)] transition-all duration-200">
      <div
        className="p-5 flex items-start gap-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Score Ring Visual */}
        <ScoreGauge score={score} size={64} />

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
              {name || "Anonymous Candidate"}
            </h3>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {totalYears > 0 ? `${totalYears} yrs exp` : "No experience listed"}
            </span>
          </div>

          <p className="text-xs font-semibold text-[var(--accent-bright)] mb-1.5 truncate">
            {primaryRole} {primaryCompany}
          </p>

          <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
            {summaryLine}
          </p>
        </div>

        {/* Expand/Collapse Chevron */}
        <button
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors self-center p-1"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          <svg
            className={`w-5 h-5 transform transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable Section */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-[var(--border)] pt-4 bg-[rgba(13,15,20,0.2)] animate-fade-in space-y-4">
          {/* Full Justification */}
          <div>
            <span className="label">Evaluation Justification</span>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {justification}
            </p>
          </div>

          {/* Matched Skills */}
          {matched_skills.length > 0 && (
            <div>
              <span className="label">Matched Skills</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {matched_skills.map((skill, idx) => (
                  <SkillChip key={`${skill}-${idx}`} name={skill} matched={true} />
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {missing_skills.length > 0 && (
            <div>
              <span className="label">Missing Skills / Gaps</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {missing_skills.map((skill, idx) => (
                  <SkillChip key={`${skill}-${idx}`} name={skill} matched={false} />
                ))}
              </div>
            </div>
          )}

          {/* Experience and Education quick review */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
            {experience.length > 0 && (
              <div>
                <span className="label">Experience</span>
                <ul className="space-y-1 mt-1 text-[11px] text-[var(--text-secondary)]">
                  {experience.slice(0, 3).map((exp, idx) => (
                    <li key={idx} className="truncate">
                      <strong>{exp.role}</strong> {exp.company ? `at ${exp.company}` : ""}{" "}
                      {exp.years ? `(${exp.years}y)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {education.length > 0 && (
              <div>
                <span className="label">Education</span>
                <ul className="space-y-1 mt-1 text-[11px] text-[var(--text-secondary)]">
                  {education.slice(0, 3).map((edu, idx) => (
                    <li key={idx} className="truncate">
                      <strong>{edu.degree}</strong> {edu.institution ? `@ ${edu.institution}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
