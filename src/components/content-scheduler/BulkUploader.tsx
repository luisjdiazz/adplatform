"use client";

import { useState, useRef } from "react";
import { Upload, X, FileVideo, FileImage, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkUploaderProps {
  clientId: string;
  batchId: string;
  onUploadComplete: (posts: any[]) => void;
}

export function BulkUploader({ clientId, batchId, onUploadComplete }: BulkUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
  ];

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const valid = Array.from(newFiles).filter((f) => acceptedTypes.includes(f.type));
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("batchId", batchId);
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/content-scheduler/posts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.posts) {
        onUploadComplete(data.posts);
        setFiles([]);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Arrastra tus archivos aqui o haz click para seleccionar</p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP, MP4, MOV, WebM — multiples archivos permitidos
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{files.length} archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}</p>
            <Button size="sm" variant="outline" onClick={() => setFiles([])}>Limpiar</Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                {file.type.startsWith("video") ? (
                  <FileVideo className="h-4 w-4 text-blue-500 shrink-0" />
                ) : (
                  <FileImage className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo {files.length} archivos...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Subir {files.length} archivo{files.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
