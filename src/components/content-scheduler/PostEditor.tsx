"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  FileVideo, FileImage, Send, Clock, CheckCircle2, AlertCircle,
  Loader2, Sparkles, Save, Trash2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PostEditorProps {
  post: any;
  onUpdate: (post: any) => void;
  onDelete: (postId: string) => void;
  onPublish: (postId: string) => void;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  SCHEDULED: { label: "Programado", color: "bg-blue-100 text-blue-700" },
  PUBLISHING: { label: "Publicando...", color: "bg-yellow-100 text-yellow-700" },
  POSTED: { label: "Publicado", color: "bg-green-100 text-green-700" },
  FAILED: { label: "Fallo", color: "bg-red-100 text-red-700" },
};

export function PostEditor({ post, onUpdate, onDelete, onPublish, onClose }: PostEditorProps) {
  const [caption, setCaption] = useState(post.caption || "");
  const [scheduledDate, setScheduledDate] = useState(
    post.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd") : ""
  );
  const [scheduledTime, setScheduledTime] = useState(
    post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : ""
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);

  const statusInfo = STATUS_LABELS[post.status] || STATUS_LABELS.DRAFT;
  const isEditable = post.status === "DRAFT" || post.status === "SCHEDULED" || post.status === "FAILED";

  async function handleSave() {
    setSaving(true);
    try {
      const scheduledAt = scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : null;

      const res = await fetch("/api/content-scheduler/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          caption,
          scheduledAt,
          status: scheduledAt ? "SCHEDULED" : "DRAFT",
        }),
      });
      const data = await res.json();
      if (data.post) onUpdate(data.post);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCopy() {
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/content-scheduler/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: [post.id] }),
      });
      const data = await res.json();
      if (data.results?.[0]?.success) {
        const result = data.results[0];
        setCaption(result.post.caption || "");
        onUpdate(result.post);
      }
    } finally {
      setGeneratingCopy(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await onPublish(post.id);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Estas seguro de eliminar este post?")) return;
    onDelete(post.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {post.fileType.startsWith("video") ? (
              <FileVideo className="h-5 w-5 text-blue-500" />
            ) : (
              <FileImage className="h-5 w-5 text-green-500" />
            )}
            <h3 className="text-lg font-semibold">Editar Post</h3>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
        </div>

        {/* Preview */}
        <div className="mb-4 rounded-lg border overflow-hidden bg-muted/20">
          {post.fileType.startsWith("video") ? (
            <video src={post.fileUrl} controls className="w-full max-h-64 object-contain bg-black" />
          ) : (
            <img src={post.fileUrl} alt="Preview" className="w-full max-h-64 object-contain" />
          )}
        </div>

        {/* Caption */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <Label>Caption</Label>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateCopy}
                disabled={generatingCopy}
              >
                {generatingCopy ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generando...</>
                ) : (
                  <><Sparkles className="mr-1 h-3 w-3" />Generar con AI</>
                )}
              </Button>
            )}
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={!isEditable}
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="Escribe el caption o genera uno con AI..."
          />
          <p className="text-xs text-muted-foreground text-right">
            {caption.length}/2200 caracteres
          </p>
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-1">
            <Label>Hora</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              disabled={!isEditable}
            />
          </div>
        </div>

        {/* AI Analysis */}
        {post.aiAnalysis && (
          <div className="mb-4 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Analisis AI</p>
            <div className="flex flex-wrap gap-2">
              {post.aiAnalysis.content_pillar && (
                <Badge variant="outline">{post.aiAnalysis.content_pillar}</Badge>
              )}
              {post.aiAnalysis.best_time && (
                <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{post.aiAnalysis.best_time}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {post.status === "FAILED" && post.errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700"><AlertCircle className="inline mr-1 h-4 w-4" />{post.errorMessage}</p>
          </div>
        )}

        {/* Published link */}
        {post.status === "POSTED" && post.igPermalink && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <a href={post.igPermalink} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Ver post en Instagram
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {isEditable && (
            <>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
              <Button
                variant="outline"
                onClick={handlePublish}
                disabled={publishing || !caption}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar ahora
              </Button>
            </>
          )}
          <div className="flex-1" />
          {isEditable && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" />Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
