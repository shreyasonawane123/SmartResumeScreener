// ============================================================
// components/ProgressStepper.tsx
//
// Shows the active processing state: "Parsing -> Extracting -> Scoring -> Done"
// with visual steps and active glows.
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
    <div className="card p-5 mb-6 animate-fade-in">
      {filename && (
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-[var(--text-secondary)] truncate max-w-[70%]">
            Analyzing: <span className="text-[var(--text-primary)]">{filename}</span>
          </span>
          <span className="text-xs text-[var(--accent-bright)] font-medium animate-pulse-soft">
            {step === "done" ? "Completed" : "Processing..."}
          </span>
        </div>
      )}
      <div className="relative flex items-center justify-between">
        {/* Progress Bar Line */}
        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-[var(--border)] -translate-y-1/2 z-0" />
        <div
          className="absolute left-0 top-1/2 h-[2px] bg-[var(--accent)] -translate-y-1/2 z-0 transition-all duration-500 ease-out"
          style={{ width: `${(Math.max(0, currentIndex) / (stepsList.length - 1)) * 100}%` }}
        />

        {stepsList.map((s, idx) => {
          const isCompleted = idx < currentIndex || step === "done";
          const isActive = idx === currentIndex && step !== "done";

          return (
            <div key={s.value} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${
                  isCompleted
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : isActive
                    ? "bg-[var(--bg-surface)] text-[var(--accent-bright)] border-[var(--accent-bright)] shadow-[0_0_8px_var(--accent-glow)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
                }`}
              >
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span
                className={`absolute top-8 whitespace-nowrap text-[10px] font-semibold tracking-wider uppercase transition-colors duration-300 ${
                  isActive
                    ? "text-[var(--accent-bright)]"
                    : isCompleted
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Visual spacer to prevent text overlap */}
      <div className="h-6" />
    </div>
  );
}
