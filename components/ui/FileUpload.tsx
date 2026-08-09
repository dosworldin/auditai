"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedFile {
  name: string;
  size: number;
  kind: string;
  raw?: File;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function FileUpload({
  accept,
  allowedKinds,
  onFileChange,
  compact = false,
}: {
  accept?: string;
  allowedKinds?: string[];
  onFileChange?: (file: SelectedFile | null) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const kind =
      (file.name.split(".").pop()?.toLowerCase() ?? file.type) || "file";
    const selectedFile: SelectedFile = {
      name: file.name,
      size: file.size,
      kind,
      raw: file,
    };
    setSelected(selectedFile);
    onFileChange?.(selectedFile);
  };

  const clearFile = () => {
    setSelected(null);
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 animate-fade-in">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {selected.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(selected.size)} - .{selected.kind}
          </p>
        </div>
        <button
          type="button"
          onClick={clearFile}
          aria-label="Remove file"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-ring/70 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-4 py-6" : "px-6 py-12",
        dragOver && "border-primary bg-accent/30",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <UploadCloud className="h-5 w-5" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Click to upload or drag and drop
        </p>
        <p className="mt-0.5 text-xs">
          {allowedKinds
            ? `Supported: ${allowedKinds.map((k) => k.toUpperCase()).join(", ")}`
            : accept
              ? `Accepted formats: ${accept}`
              : "PDF, DOCX, TXT, images and more"}
        </p>
      </div>
    </button>
  );
}
