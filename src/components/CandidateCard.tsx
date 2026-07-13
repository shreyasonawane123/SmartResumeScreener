"use client";

// ============================================================
// components/CandidateCard.tsx
//
// Folder-tab dossier card. Shortlisted cards get a rotated
// rubber-stamp "SHORTLISTED" mark. Skills render as rectangular
// index tags. Justification text uses monospace typewriter face.
// ============================================================

import { useState } from "react";
import type { CandidateScore } from "@/lib/types";
import { ScoreGauge } from "./ScoreGauge";
import { SkillChip } from "./SkillChip";

interface CandidateCardProps {
  candidate: CandidateScore;
  isShortlisted: boolean;
}

// SVG filter for rough stamp texture — embedded once per card
function StampFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feDisplacementMap in="SourceGraphic" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export function CandidateCard({ candidate, isShortlisted }: CandidateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { resume, score_result } = candidate;
  const { name, skills, experience, education } = resume.structured_json;
  const { score, justification, matched_skills, missing_skills } = score_result;

  const firstSentence = justification.split(/[.!?]/)[0];
  const summaryLine = firstSentence ? `${firstSentence}.` : justification;

  const totalYears = experience.reduce((sum, exp) => sum + (exp.years || 0), 0);
  const primaryRole = experience[0]?.role || "Role unspecified";
  const primaryCompany = experience[0]?.company ? `@ ${experience[0].company}` : "";

  const stampId = `stamp-${candidate.score_id.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div
      className="card-folder overflow-hidden animate-slide-up"
      style={{ position: "relative" }}
    >
      {/* SVG stamp filter (hidden) */}
      {isShortlisted && <StampFilter id={stampId} />}

      {/* ── Rubber stamp for shortlisted ── */}
      {isShortlisted && (
        <div className="stamp-shortlisted">
          <div
            className="stamp-shortlisted-inner"
            style={{ filter: `url(#${stampId})` }}
          >
            SHORTLISTED
          </div>
        </div>
      )}

      {/* ── Card header (clickable) ── */}
      <div
        className="p-5 flex items-start gap-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Score Ring */}
        <ScoreGauge score={score} size={62} />

        {/* Text Block */}
        <div className="flex-1 min-w-0">
          {/* Paperclip + filename header */}
          <div
            className="flex items-center gap-1.5 mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {/* Paperclip icon */}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span
              className="text-[10px] truncate max-w-[200px]"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--text-muted)" }}
            >
              {resume.filename}
            </span>
          </div>

          {/* Candidate name */}
          <h3
            className="text-sm font-bold truncate mb-0.5"
            style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}
          >
            {name || "Anonymous Candidate"}
          </h3>

          {/* Role + years */}
          <p
            className="text-[11px] mb-1.5 truncate"
            style={{ color: "var(--text-secondary)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {primaryRole} {primaryCompany}
            {totalYears > 0 && (
              <span style={{ color: "var(--text-muted)" }}> · {totalYears}y exp</span>
            )}
          </p>

          {/* One-line summary */}
          <p
            className="text-[11px] line-clamp-1 italic"
            style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {summaryLine}
          </p>
        </div>

        {/* Expand chevron */}
        <button
          className="shrink-0 self-center p-1 transition-colors"
          style={{ color: "var(--text-muted)" }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          <svg
            className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* ── Expandable dossier detail section ── */}
      {isExpanded && (
        <div
          className="px-5 pb-5 pt-4 animate-fade-in space-y-4"
          style={{ borderTop: "1px solid var(--border)", background: "rgba(28,36,56,0.025)" }}
        >
          {/* Justification */}
          <div>
            <span className="field-label">Evaluation Note</span>
            <p
              className="text-[11px] leading-relaxed mt-1"
              style={{ color: "var(--text-secondary)", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {justification}
            </p>
          </div>

          {/* Matched Skills */}
          {matched_skills.length > 0 && (
            <div>
              <span className="field-label" style={{ color: "var(--skill-matched-text)" }}>
                Matched Requirements
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {matched_skills.map((skill, idx) => (
                  <SkillChip key={`${skill}-${idx}`} name={skill} matched={true} />
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {missing_skills.length > 0 && (
            <div>
              <span className="field-label" style={{ color: "var(--skill-missing-text)" }}>
                Gaps / Missing
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {missing_skills.map((skill, idx) => (
                  <SkillChip key={`${skill}-${idx}`} name={skill} matched={false} />
                ))}
              </div>
            </div>
          )}

          {/* Experience + Education */}
          <div
            className="grid grid-cols-2 gap-4 pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {experience.length > 0 && (
              <div>
                <span className="field-label">Work History</span>
                <ul
                  className="space-y-1 mt-1"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "var(--text-secondary)" }}
                >
                  {experience.slice(0, 3).map((exp, idx) => (
                    <li key={idx} className="truncate">
                      <strong>{exp.role}</strong>
                      {exp.company ? ` — ${exp.company}` : ""}
                      {exp.years ? ` (${exp.years}y)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {education.length > 0 && (
              <div>
                <span className="field-label">Education</span>
                <ul
                  className="space-y-1 mt-1"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "var(--text-secondary)" }}
                >
                  {education.slice(0, 3).map((edu, idx) => (
                    <li key={idx} className="truncate">
                      <strong>{edu.degree}</strong>
                      {edu.institution ? ` @ ${edu.institution}` : ""}
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
