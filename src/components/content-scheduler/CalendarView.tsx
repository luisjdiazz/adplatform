"use client";

import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { FileVideo, FileImage, Clock, CheckCircle2, AlertCircle, Send, Play, X, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Post {
  id: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  hashtags?: string[];
  aiAnalysis?: any;
  scheduledAt: string | null;
  status: string;
  igPermalink: string | null;
}

interface CalendarViewProps {
  posts: Post[];
  monthYear: string; // "2026-03"
  onPostClick: (post: Post) => void;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  POSTED: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, any> = {
  DRAFT: Clock,
  SCHEDULED: Clock,
  PUBLISHING: Send,
  POSTED: CheckCircle2,
  FAILED: AlertCircle,
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  POSTED: "Publicado",
  FAILED: "Fallo",
};

// Quick preview overlay
function PostPreview({ post, onClose, onEdit }: { post: Post; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media preview */}
        <div className="relative bg-black">
          {post.fileType.startsWith("video") ? (
            <video
              src={post.fileUrl}
              controls
              autoPlay
              muted
              className="w-full max-h-[400px] object-contain"
            />
          ) : (
            <img
              src={post.fileUrl}
              alt=""
              className="w-full max-h-[400px] object-contain"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {post.fileType.startsWith("video") && (
            <Badge className="absolute top-2 left-2 bg-blue-500 text-white">Reel</Badge>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          {/* Status + time */}
          <div className="flex items-center justify-between">
            <Badge className={STATUS_COLORS[post.status]}>
              {STATUS_LABELS[post.status] || post.status}
            </Badge>
            {post.scheduledAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(post.scheduledAt), "dd MMM yyyy · HH:mm", { locale: es })}
              </span>
            )}
          </div>

          {/* Caption */}
          {post.caption ? (
            <p className="text-sm leading-relaxed whitespace-pre-line line-clamp-4">
              {post.caption}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin caption</p>
          )}

          {/* AI analysis pills */}
          {post.aiAnalysis && (
            <div className="flex flex-wrap gap-1.5">
              {post.aiAnalysis.content_pillar && (
                <Badge variant="outline" className="text-xs">{post.aiAnalysis.content_pillar}</Badge>
              )}
              {post.aiAnalysis.best_time && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="mr-1 h-3 w-3" />{post.aiAnalysis.best_time}
                </Badge>
              )}
            </div>
          )}

          {/* Edit button */}
          <button
            onClick={onEdit}
            className="w-full rounded-lg border bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Editar post
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarView({ posts, monthYear, onPostClick }: CalendarViewProps) {
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [year, month] = monthYear.split("-").map(Number);
  const monthDate = new Date(year, month - 1);

  const days = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    return eachDayOfInterval({ start, end });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // Group posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of posts) {
      if (post.scheduledAt) {
        const dateKey = format(new Date(post.scheduledAt), "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(post);
      }
    }
    return map;
  }, [posts]);

  // Unscheduled posts
  const unscheduledPosts = posts.filter((p) => !p.scheduledAt);
  const scheduledCount = posts.length - unscheduledPosts.length;

  // Day of week headers
  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  // Offset for first day (Monday = 0)
  const firstDayOffset = days.length > 0 ? (getDay(days[0]) + 6) % 7 : 0;

  return (
    <div className="space-y-4">
      {/* Month header + stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">
          {format(monthDate, "MMMM yyyy", { locale: es })}
        </h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{scheduledCount} programado{scheduledCount !== 1 ? "s" : ""}</span>
          {unscheduledPosts.length > 0 && (
            <span className="text-amber-600">{unscheduledPosts.length} sin fecha</span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[120px] border-b border-r bg-muted/10" />
          ))}

          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDate[dateKey] || [];
            const past = isBefore(day, new Date()) && !isToday(day);

            return (
              <div
                key={dateKey}
                className={`min-h-[120px] border-b border-r p-1 ${
                  isToday(day) ? "bg-primary/5" : past ? "bg-muted/20" : ""
                }`}
              >
                <div className={`text-xs font-medium mb-1 px-1 ${
                  isToday(day) ? "text-primary" : past ? "text-muted-foreground" : ""
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayPosts.map((post) => {
                    const StatusIcon = STATUS_ICONS[post.status] || Clock;
                    const isVideo = post.fileType.startsWith("video");
                    return (
                      <button
                        key={post.id}
                        onClick={() => setPreviewPost(post)}
                        className={`w-full rounded overflow-hidden text-left text-xs border transition-all hover:shadow-md hover:scale-[1.02] ${STATUS_COLORS[post.status]}`}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-full h-14 bg-muted">
                          {isVideo ? (
                            <div className="flex h-full items-center justify-center bg-gray-900">
                              <Play className="h-4 w-4 text-white/80" />
                            </div>
                          ) : (
                            <img
                              src={post.fileUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                          {/* Status icon overlay */}
                          <div className="absolute top-0.5 right-0.5">
                            <StatusIcon className="h-3 w-3 drop-shadow" />
                          </div>
                          {isVideo && (
                            <div className="absolute bottom-0.5 left-0.5">
                              <span className="bg-blue-500 text-white text-[9px] px-1 rounded font-medium">REEL</span>
                            </div>
                          )}
                          {/* Preview eye icon on hover */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group">
                            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        {/* Time + caption snippet */}
                        <div className="px-1 py-0.5">
                          <span className="font-medium">
                            {post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : ""}
                          </span>
                          {post.caption && (
                            <p className="truncate opacity-75 text-[10px] leading-tight">
                              {post.caption.substring(0, 40)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled posts */}
      {unscheduledPosts.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">
            Sin programar ({unscheduledPosts.length})
          </h4>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {unscheduledPosts.map((post) => {
              const isVideo = post.fileType.startsWith("video");
              return (
                <button
                  key={post.id}
                  onClick={() => setPreviewPost(post)}
                  className="group relative rounded-lg border overflow-hidden aspect-square hover:shadow-md transition-all hover:scale-105"
                >
                  {isVideo ? (
                    <div className="flex h-full items-center justify-center bg-gray-900">
                      <Play className="h-5 w-5 text-white/60" />
                      <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-[9px] px-1 rounded font-medium">REEL</span>
                    </div>
                  ) : (
                    <img src={post.fileUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <Badge
                    variant="outline"
                    className="absolute top-1 right-1 text-[9px] bg-white/80 backdrop-blur-sm"
                  >
                    {post.caption ? "Draft" : "Sin copy"}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview overlay */}
      {previewPost && (
        <PostPreview
          post={previewPost}
          onClose={() => setPreviewPost(null)}
          onEdit={() => {
            onPostClick(previewPost);
            setPreviewPost(null);
          }}
        />
      )}
    </div>
  );
}
