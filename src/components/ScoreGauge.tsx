"use client";

// ============================================================
// components/ScoreGauge.tsx
//
// SVG circular ring that visualizes a 1–10 score as a filled arc.
// Animates on mount. Color transitions from red (1–4) through
// amber (5–6) to green (7–10).
// ============================================================

interface ScoreGaugeProps {
  score: number; // 1–10
  size?: number; // diameter in px, default 72
}

function getScoreColor(score: number): string {
  if (score <= 4) return "#ef4444"; // red
  if (score <= 6) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

export function ScoreGauge({ score, size = 72 }: ScoreGaugeProps) {
  const radius = (size - 8) / 2; // 4px padding on each side for stroke
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(Math.max(score, 0), 10) / 10;
  const dashOffset = circumference * (1 - fraction);
  const color = getScoreColor(score);

  const center = size / 2;

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score: ${score} out of 10`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={6}
          fill="none"
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      {/* Score number in the center */}
      <span
        className="absolute font-bold"
        style={{
          fontSize: size < 60 ? "1rem" : "1.25rem",
          color,
          lineHeight: 1,
        }}
      >
        {score.toFixed(score % 1 === 0 ? 0 : 1)}
      </span>
    </div>
  );
}
