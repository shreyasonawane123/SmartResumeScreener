"use client";

// ============================================================
// components/ResumeUploader.tsx
//
// File uploader. Supports drag-and-drop, displays list of
// uploaded files with their parsing/extracting/done status.
// ============================================================

import { useState, useRef } from "react";
import type { StoredResume } from "@/lib/types";

interface ResumeUploaderProps {
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
  onUploadSuccess,
  onSetError,
  existingResumeCount,
}: ResumeUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  // Process and upload files sequentially to show individual progress
  const processFiles = async (files: File[]) => {
    onSetError(null);

    // Filter for PDFs or plain text
    const validFiles = files.filter((f) => {
      const isValidType = f.type === "application/pdf" || f.type === "text/plain";
      if (!isValidType) {
        onSetError(`Skipped "${f.name}": Unsupported format. Only PDF and TXT allowed.`);
      }
      return isValidType;
    });

    if (validFiles.length === 0) return;

    // Map files to local state
    const newUploads = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      status: "idle" as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const tracking = newUploads[i];

      updateFileStatus(tracking.id, "parsing");

      const formData = new FormData();
      formData.append("files", file);

      try {
        // Step 1: Simulated step change, since server API parses + extracts in one request
        // We'll advance the status visually.
        const timer = setTimeout(() => {
          updateFileStatus(tracking.id, "extracting");
        }, 1200);

        const res = await fetch("/api/resumes", {
          method: "POST",
          body: formData,
        });

        clearTimeout(timer);

        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || `Upload failed for ${file.name}`);
        }

        updateFileStatus(tracking.id, "completed");
        onUploadSuccess(json.data);
      } catch (err) {
        updateFileStatus(
          tracking.id,
          "error",
          err instanceof Error ? err.message : "Unknown error",
        );
      }
    }
  };

  const updateFileStatus = (id: string, status: UploadingFile["status"], errorMsg?: string) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, errorMsg } : f)),
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Box Area */}
      <div
        className={`card border-dashed p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          isDragActive ? "drag-active border-[var(--accent-bright)] bg-[rgba(124,58,237,0.05)]" : "border-[var(--border)]"
        }`}
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
          className="w-10 h-10 text-[var(--accent-bright)] mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <h3 className="text-sm font-bold text-[var(--text-primary)]">Upload Candidate Resumes</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Drag & drop PDF or TXT files here, or click to browse.
        </p>
        <span className="text-[10px] text-[var(--text-muted)] mt-2 font-mono">
          Maximum size 10MB per file. {existingResumeCount} resume(s) in database.
        </span>
      </div>

      {/* Progress / Status list */}
      {uploadingFiles.length > 0 && (
        <div className="card p-4 space-y-3">
          <span className="label">Processing Pipeline</span>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {uploadingFiles.map((file) => {
              const statusColor =
                file.status === "completed"
                  ? "text-[var(--success)]"
                  : file.status === "error"
                  ? "text-[var(--error)]"
                  : "text-[var(--accent-bright)]";

              const statusText =
                file.status === "parsing"
                  ? "Parsing text..."
                  : file.status === "extracting"
                  ? "Extracting skills..."
                  : file.status === "completed"
                  ? "Done"
                  : file.status === "error"
                  ? "Failed"
                  : "Queued";

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between text-xs border-b border-[rgba(255,255,255,0.03)] pb-2 last:border-0 last:pb-0"
                >
                  <span className="truncate max-w-[60%] font-medium text-[var(--text-primary)]">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {file.status !== "completed" && file.status !== "error" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-bright)] animate-ping" />
                    )}
                    <span className={`font-semibold ${statusColor}`}>{statusText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
