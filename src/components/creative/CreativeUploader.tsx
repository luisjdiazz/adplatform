"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image, Film, Loader2 } from "lucide-react";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 300 * 1024 * 1024;

interface CreativeUploaderProps {
  clientId: string;
  onAnalysisComplete: (data: { upload: any; analysisResult: any }) => void;
}

export function CreativeUploader({ clientId, onAnalysisComplete }: CreativeUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }, []);

  function selectFile(f: File) {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Formato no soportado. Usa JPG, PNG, WebP, MP4, MOV o WebM");
      return;
    }
    const video = VIDEO_TYPES.includes(f.type);
    const maxSize = video ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (f.size > maxSize) {
      setError(`El archivo no puede pesar mas de ${video ? "100MB" : "10MB"}`);
      return;
    }
    setFile(f);
    setIsVideo(video);
    setError("");
    setPreview(URL.createObjectURL(f));
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);

    try {
      const res = await fetch("/api/ai/analyze-creative", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAnalysisComplete(data);
    } catch (err: any) {
      setError(err.message || "Error al analizar el creativo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
        >
          {preview ? (
            <div className="space-y-4 text-center">
              {isVideo ? (
                <video
                  src={preview}
                  controls
                  className="mx-auto max-h-64 rounded-lg"
                />
              ) : (
                <img src={preview} alt="Preview" className="mx-auto max-h-64 rounded-lg" />
              )}
              <p className="text-sm text-muted-foreground">{file?.name}</p>
              {isVideo && (
                <p className="text-xs text-blue-500 font-medium">
                  Video - se extraeran frames y audio para analisis
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <div className="flex justify-center gap-2">
                <Image className="h-10 w-10 text-muted-foreground" />
                <Film className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Arrastra tu creativo aqui</p>
              <p className="text-xs text-muted-foreground">
                Imagenes: JPG, PNG, WebP (hasta 10MB)
              </p>
              <p className="text-xs text-muted-foreground">
                Videos: MP4, MOV, WebM (hasta 300MB)
              </p>
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            className="hidden"
            id="creative-upload"
            onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
          />

          <div className="mt-4 flex gap-2">
            <Button variant="outline" asChild>
              <label htmlFor="creative-upload" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Seleccionar archivo
              </label>
            </Button>
            {file && (
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isVideo ? "Procesando video..." : "Analizando..."}
                  </>
                ) : (
                  "Analizar con IA"
                )}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
