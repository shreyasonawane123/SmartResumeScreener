"use client";

// ============================================================
// components/ErrorBanner.tsx — dossier palette
// ============================================================

interface ErrorBannerProps {
  message: string | null;
  onClear: () => void;
}

export function ErrorBanner({ message, onClear }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className="rounded p-4 flex gap-3 items-start animate-fade-in mb-5"
      style={{
        background: "rgba(178,58,46,0.06)",
        border: "1px solid rgba(178,58,46,0.22)",
      }}
    >
      <svg
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "var(--error)" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1 min-w-0">
        <h4
          className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
          style={{ color: "var(--error)", fontFamily: "'Inter', sans-serif" }}
        >
          Error
        </h4>
        <p
          className="text-[10px] leading-relaxed break-words whitespace-pre-line"
          style={{ color: "var(--text-secondary)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {message}
        </p>
      </div>
      <button
        onClick={onClear}
        className="p-1 transition-opacity hover:opacity-60"
        style={{ color: "var(--text-muted)" }}
        aria-label="Dismiss error"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
