"use client";

// ============================================================
// components/ErrorBanner.tsx
//
// A custom component for showing inline/dismissible error details,
// styled cleanly using our core design variables.
// ============================================================

interface ErrorBannerProps {
  message: string | null;
  onClear: () => void;
}

export function ErrorBanner({ message, onClear }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.2)] rounded-lg p-4 flex gap-3 items-start animate-fade-in mb-6">
      {/* Warning/Error icon */}
      <svg
        className="w-5 h-5 text-[var(--error)] shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      {/* Content details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">Something went wrong</h4>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed break-words whitespace-pre-line">
          {message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={onClear}
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors"
        aria-label="Dismiss error"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
