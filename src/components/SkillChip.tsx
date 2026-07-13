// ============================================================
// components/SkillChip.tsx
//
// Display a single skill badge, styled differently based on
// whether it matches the job description or is missing.
// ============================================================

interface SkillChipProps {
  name: string;
  matched: boolean;
}

export function SkillChip({ name, matched }: SkillChipProps) {
  const badgeClass = matched
    ? "bg-[var(--skill-matched-bg)] text-[var(--skill-matched-text)] border-[var(--skill-matched-border)]"
    : "bg-[var(--skill-missing-bg)] text-[var(--skill-missing-text)] border-[var(--skill-missing-border)]";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass} transition-colors duration-150`}
    >
      {name}
    </span>
  );
}
