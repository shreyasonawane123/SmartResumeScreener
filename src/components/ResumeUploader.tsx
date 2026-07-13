"use client";

// ============================================================
// components/ResumeUploader.tsx — dossier palette
//
// Upload is gated on jobDescriptionId:
// - If empty: shows an inline prompt instead of the drop zone.
// - If set: appends job_description_id to each FormData POST
//   so the API can scope the resume to the correct opening.
// ============================================================

import { useState, useRef } from "react";
import type { StoredResume } from "@/lib/types";

interface ResumeUploaderProps {
  /** The currently active job description ID. Upload is disabled if empty. */
  jobDescriptionId: string;
  onUploadSuccess: (resumes: StoredResume[]) => void;
  onSetError: (err: string | null) => void;
  existingResumeCount: number;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: "idle" | "parsing" | "extracting" | "completed" | "error";
  errorMsg?: string;
}

export function ResumeUploader({
  jobDescriptionId,
  onUploadSuccess,
  onSetError,
  existingResumeCount,
}: ResumeUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragActive(true);
    else if (e.type === "dragleave") setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (!jobDescriptionId) return; // guard — should not reach here but be safe
    if (e.dataTransfer.files?.length) processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(Array.from(e.target.files));
  };

  const processFiles = async (files: File[]) => {
    onSetError(null);
    const validFiles = files.filter((f) => {
      const ok = f.type === "application/pdf" || f.type === "text/plain";
      if (!ok) onSetError(`Skipped "${f.name}": Only PDF and TXT allowed.`);
      return ok;
    });
    if (!validFiles.length) return;

    const newUploads = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      status: "idle" as const,
    }));
    setUploadingFiles(newUploads);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const tracking = newUploads[i];
      updateStatus(tracking.id, "parsing");

      const formData = new FormData();
      formData.append("files", file);
      // Scope this upload to the active job description
      formData.append("job_description_id", jobDescriptionId);

      try {
        const timer = setTimeout(() => updateStatus(tracking.id, "extracting"), 1200);
        const res = await fetch("/api/resumes", { method: "POST", body: formData });
        clearTimeout(timer);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || `Upload failed for ${file.name}`);
        updateStatus(tracking.id, "completed");
        onUploadSuccess(json.data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        updateStatus(tracking.id, "error", errorMsg);
        onSetError(errorMsg);
      }
    }
  };

  const updateStatus = (id: string, status: UploadingFile["status"], errorMsg?: string) => {
    setUploadingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, errorMsg } : f)));
  };

  // ── Gate: no job selected ──
  if (!jobDescriptionId) {
    return (
      <div
        className="card p-6 flex flex-col items-center justify-center text-center gap-3"
        style={{ borderStyle: "dashed" }}
      >
        {/* Lock / folder icon */}
        <svg
          className="w-8 h-8"
          style={{ color: "var(--text-muted)", opacity: 0.45 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div>
          <p
            className="text-[11px] font-bold tracking-widest uppercase mb-1"
            style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}
          >
            No Job Description Active
          </p>
          <p
            className="text-[10px] leading-relaxed max-w-[260px]"
            style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Select or create a job description above before uploading resumes.
            Resumes are scoped to the opening they are uploaded for.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`card p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isDragActive ? "drag-active" : ""}`}
        style={{ borderStyle: "dashed" }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.txt"
          onChange={handleFileChange}
        />

        <svg
          className="w-9 h-9 mb-3"
          style={{ color: "var(--text-muted)", opacity: 0.6 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>

        <h3
          className="text-xs font-bold tracking-widest uppercase mb-1"
          style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}
        >
          Upload Candidate Resumes
        </h3>
        <p
          className="text-[10px]"
          style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Drag &amp; drop PDF or TXT, or click to browse.
        </p>
        <span
          className="text-[9px] mt-2"
          style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Max 10 MB per file · {existingResumeCount} file{existingResumeCount !== 1 ? "s" : ""} for this job
        </span>
      </div>

      {/* Upload progress list */}
      {uploadingFiles.length > 0 && (
        <div className="card p-4 space-y-3">
          <span className="label">Processing Pipeline</span>
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {uploadingFiles.map((file) => {
              const statusColor =
                file.status === "completed"
                  ? "var(--success)"
                  : file.status === "error"
                  ? "var(--error)"
                  : "var(--text-secondary)";

              const statusText =
                file.status === "parsing" ? "Parsing…"
                : file.status === "extracting" ? "Extracting…"
                : file.status === "completed" ? "✓ Done"
                : file.status === "error" ? "✗ Failed"
                : "Queued";

              return (
                <div
                  key={file.id}
                  className="flex flex-col pb-2 last:pb-0 gap-1"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className="truncate max-w-[60%] font-medium"
                      style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {file.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {file.status !== "completed" && file.status !== "error" && (
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: "var(--text-muted)" }} />
                      )}
                      <span style={{ color: statusColor, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                  {file.status === "error" && file.errorMsg && (
                    <span
                      className="text-[9px] leading-normal break-words"
                      style={{ color: "var(--error)", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {file.errorMsg}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
