// ============================================================
// components/ProgressStepper.tsx — dossier palette
// ============================================================

import { ProcessingStep } from "@/lib/types";

interface ProgressStepperProps {
  step: ProcessingStep;
  filename?: string;
}

export function ProgressStepper({ step, filename }: ProgressStepperProps) {
  if (step === "idle" || step === "error") return null;

  const stepsList: { label: string; value: ProcessingStep }[] = [
    { label: "Parsing", value: "parsing" },
    { label: "Extracting", value: "extracting" },
    { label: "Scoring", value: "scoring" },
    { label: "Done", value: "done" },
  ];

  const getStepIndex = (s: ProcessingStep) => {
    if (s === "parsing") return 0;
    if (s === "extracting") return 1;
    if (s === "scoring") return 2;
    if (s === "done") return 3;
    return -1;
  };

  const currentIndex = getStepIndex(step);

  return (
    <div
      className="card p-5 mb-6 animate-fade-in"
      style={{ borderLeft: "3px solid var(--text-primary)", borderRadius: "0 4px 4px 0" }}
    >
      {filename && (
        <div className="flex justify-between items-center mb-3">
          <span
            className="text-[10px] truncate max-w-[70%]"
            style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            analysing: <span style={{ color: "var(--text-primary)" }}>{filename}</span>
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase animate-pulse-soft"
            style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}
          >
            {step === "done" ? "Complete" : "Processing…"}
          </span>
        </div>
      )}

      <div className="relative flex items-center justify-between">
        {/* Track line */}
        <div
          className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 z-0"
          style={{ background: "var(--border)" }}
        />
        {/* Progress fill */}
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 z-0 transition-all duration-500 ease-out"
          style={{
            width: `${(Math.max(0, currentIndex) / (stepsList.length - 1)) * 100}%`,
            background: "var(--text-primary)",
          }}
        />

        {stepsList.map((s, idx) => {
          const isCompleted = idx < currentIndex || step === "done";
          const isActive = idx === currentIndex && step !== "done";

          return (
            <div key={s.value} className="relative z-10 flex flex-col items-center">
              <div
                className="w-5 h-5 flex items-center justify-center text-[9px] font-bold border transition-all duration-300"
                style={{
                  borderRadius: "2px",
                  background: isCompleted
                    ? "var(--text-primary)"
                    : isActive
                    ? "var(--bg-base)"
                    : "var(--bg-surface)",
                  border: `1px solid ${isCompleted || isActive ? "var(--text-primary)" : "var(--border)"}`,
                  color: isCompleted
                    ? "var(--bg-base)"
                    : isActive
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span
                className="absolute top-7 whitespace-nowrap text-[9px] font-bold tracking-widest uppercase transition-colors duration-300"
                style={{
                  color: isActive ? "var(--text-primary)" : isCompleted ? "var(--text-secondary)" : "var(--text-muted)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-5" />
    </div>
  );
}
