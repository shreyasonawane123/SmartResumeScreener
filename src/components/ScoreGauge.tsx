"use client";

// ============================================================
// components/ScoreGauge.tsx
// Navy track ring + sage/clay arc palette (no purple/green).
// ============================================================

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score <= 4) return "#B23A2E"; // stamp-red / clay-red
  if (score <= 6) return "#A66B4F"; // muted clay
  return "#5C7A5C";                 // sage green
}

export function ScoreGauge({ score, size = 72 }: ScoreGaugeProps) {
  const radius = (size - 8) / 2;
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
        {/* Background track — hairline navy */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(28,36,56,0.10)"
          strokeWidth={5}
          fill="none"
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </svg>
      {/* Score number */}
      <span
        className="absolute font-bold"
        style={{
          fontSize: size < 60 ? "0.9rem" : "1.1rem",
          color,
          lineHeight: 1,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {score.toFixed(score % 1 === 0 ? 0 : 1)}
      </span>
    </div>
  );
}
