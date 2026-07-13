// ============================================================
// components/SkillChip.tsx — rectangular index tag style
// ============================================================

interface SkillChipProps {
  name: string;
  matched: boolean;
}

export function SkillChip({ name, matched }: SkillChipProps) {
  return (
    <span className={matched ? "skill-tag-matched" : "skill-tag-missing"}>
      {matched ? "✓ " : "✗ "}{name}
    </span>
  );
}
