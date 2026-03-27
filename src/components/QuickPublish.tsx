"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Sparkles, Send, Loader2, Image, Film, CheckCircle, Instagram } from "lucide-react";

interface MetaAccountInfo {
  id: string;
  accountName: string | null;
  igAccountId: string | null;
  igUsername: string | null;
}

interface QuickPublishProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  metaAccounts: MetaAccountInfo[];
}

type Step = "upload" | "generating" | "review" | "publishing" | "done";

export default function QuickPublish({ open, onOpenChange, clientId, clientName, metaAccounts }: QuickPublishProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userContext, setUserContext] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [engagementPrompt, setEngagementPrompt] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [fileType, setFileType] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [permalink, setPermalink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const igAccounts = metaAccounts.filter((a) => a.igAccountId);

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setUserContext("");
    setCaption("");
    setHashtags("");
    setEngagementPrompt("");
    setFileUrl("");
    setFileKey("");
    setFileType("");
    setPermalink(null);
    setError(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else if (f.type.startsWith("video/")) {
      setPreview(URL.createObjectURL(f));
    }
  }

  async function generateCopy() {
    if (!file) return;
    setStep("generating");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("action", "generate-copy");
      formData.append("clientId", clientId);
      formData.append("file", file);
      if (userContext) formData.append("userContext", userContext);

      const res = await fetch("/api/content-scheduler/quick-publish", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFileUrl(data.fileUrl);
      setFileKey(data.fileKey);
      setFileType(data.fileType);
      setCaption(data.aiResult.caption || "");
      setHashtags(data.aiResult.hashtags?.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ") || "");
      setEngagementPrompt(data.aiResult.engagement_prompt || "");

      if (igAccounts.length === 1) {
        setSelectedAccountId(igAccounts[0].id);
      }

      setStep("review");
    } catch (err: any) {
      setError(err.message || "Error generando copy");
      setStep("upload");
    }
  }

  async function publish() {
    setStep("publishing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("action", "publish");
      formData.append("clientId", clientId);
      formData.append("metaAccountId", selectedAccountId);
      formData.append("caption", caption);
      formData.append("hashtags", hashtags);
      formData.append("fileUrl", fileUrl);
      formData.append("fileKey", fileKey);
      formData.append("fileType", fileType);

      const res = await fetch("/api/content-scheduler/quick-publish", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPermalink(data.permalink);
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Error publicando");
      setStep("review");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Publicar en Instagram — {clientName}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <div className="w-full max-w-sm">
                  {file?.type.startsWith("video/") ? (
                    <video src={preview} controls className="w-full rounded-md" />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full rounded-md object-cover" />
                  )}
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {file?.type.startsWith("video/") ? <Film className="inline h-3 w-3 mr-1" /> : <Image className="inline h-3 w-3 mr-1" />}
                    {file?.name}
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click para seleccionar imagen o video</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, MP4, MOV</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="space-y-2">
              <Label>Contexto adicional (opcional)</Label>
              <Textarea
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="Ej: Es un post sobre nuestra nueva coleccion de verano, queremos destacar los precios..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Dale contexto al AI para que genere un copy mas preciso para tu marca
              </p>
            </div>

            <Button
              className="w-full"
              onClick={generateCopy}
              disabled={!file}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generar copy con AI
            </Button>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analizando contenido y generando copy...</p>
            <p className="text-xs text-muted-foreground">El AI esta usando el perfil de marca de {clientName}</p>
          </div>
        )}

        {/* Step 3: Review & Edit */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preview */}
              <div>
                {fileType.startsWith("video/") ? (
                  <video src={preview || fileUrl} controls className="w-full rounded-md" />
                ) : (
                  <img src={preview || fileUrl} alt="Preview" className="w-full rounded-md object-cover" />
                )}
                <Badge className="mt-2" variant="outline">
                  {fileType.startsWith("video/") ? "Reel" : "Post"}
                </Badge>
              </div>

              {/* Copy editor */}
              <div className="space-y-3">
                {igAccounts.length > 1 && (
                  <div className="space-y-1">
                    <Label>Cuenta de Instagram</Label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona cuenta</option>
                      {igAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          @{acc.igUsername || acc.accountName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {igAccounts.length === 1 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Instagram className="h-4 w-4" />
                    <span>@{igAccounts[0].igUsername || igAccounts[0].accountName}</span>
                  </div>
                )}

                {igAccounts.length === 0 && (
                  <div className="rounded-md bg-yellow-500/10 p-2 text-sm text-yellow-600">
                    No hay cuenta de Instagram conectada
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Hashtags</Label>
              <Textarea
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>

            {engagementPrompt && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Sugerencia de engagement:</p>
                <p className="text-sm">{engagementPrompt}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setError(null); }} className="flex-1">
                Volver
              </Button>
              <Button
                onClick={publish}
                disabled={!selectedAccountId || igAccounts.length === 0}
                className="flex-1"
              >
                <Send className="mr-2 h-4 w-4" />
                Publicar ahora
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Publishing */}
        {step === "publishing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Publicando en Instagram...</p>
            <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos para videos</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Publicado exitosamente!</p>
            {permalink && (
              <a
                href={permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Ver en Instagram
              </a>
            )}
            <Button onClick={() => { reset(); onOpenChange(false); }}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
