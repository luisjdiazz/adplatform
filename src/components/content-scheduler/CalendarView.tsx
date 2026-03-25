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
  postType?: string;
  carouselGroupId?: string | null;
  carouselOrder?: number | null;
  userContext?: string | null;
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

// Quick preview overlay with carousel support
function PostPreview({ post, carouselSlides, onClose, onEdit }: {
  post: Post;
  carouselSlides: Post[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const isCarousel = carouselSlides.length > 1;
  const currentMedia = isCarousel ? carouselSlides[activeSlide] : post;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media preview */}
        <div className="relative bg-black">
          {currentMedia.fileType.startsWith("video") ? (
            <video
              key={currentMedia.id}
              src={currentMedia.fileUrl}
              controls
              autoPlay
              muted
              className="w-full max-h-[400px] object-contain"
            />
          ) : (
            <img
              key={currentMedia.id}
              src={currentMedia.fileUrl}
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

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            {isCarousel ? (
              <Badge className="bg-purple-500 text-white">Carrusel {activeSlide + 1}/{carouselSlides.length}</Badge>
            ) : post.postType === "REEL" || post.fileType.startsWith("video") ? (
              <Badge className="bg-blue-500 text-white">Reel</Badge>
            ) : null}
          </div>

          {/* Carousel navigation arrows */}
          {isCarousel && (
            <>
              {activeSlide > 0 && (
                <button
                  onClick={() => setActiveSlide((s) => s - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
                >
                  ‹
                </button>
              )}
              {activeSlide < carouselSlides.length - 1 && (
                <button
                  onClick={() => setActiveSlide((s) => s + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
                >
                  ›
                </button>
              )}
            </>
          )}
        </div>

        {/* Carousel dots */}
        {isCarousel && (
          <div className="flex justify-center gap-1.5 py-2 bg-muted/30">
            {carouselSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === activeSlide ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}

        {/* Carousel thumbnails strip */}
        {isCarousel && (
          <div className="flex gap-1 px-4 py-2 overflow-x-auto">
            {carouselSlides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlide(i)}
                className={`relative shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                  i === activeSlide ? "border-primary" : "border-transparent opacity-60"
                }`}
              >
                <img src={slide.fileUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        )}

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

          {/* User context */}
          {post.userContext && (
            <div className="rounded bg-amber-50 border border-amber-200 px-3 py-1.5">
              <p className="text-xs text-amber-800"><span className="font-medium">Contexto:</span> {post.userContext}</p>
            </div>
          )}

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

  // Group carousel slides by carouselGroupId
  const carouselSlidesMap = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (post.postType === "CAROUSEL" && post.carouselGroupId) {
        const group = map.get(post.carouselGroupId) || [];
        group.push(post);
        map.set(post.carouselGroupId, group);
      }
    }
    // Sort each group by carouselOrder
    for (const [, slides] of map) {
      slides.sort((a, b) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0));
    }
    return map;
  }, [posts]);

  // Get the "display posts" — collapse carousel slides into one entry (the cover)
  const displayPosts = useMemo(() => {
    const seenCarousels = new Set<string>();
    return posts.filter((p) => {
      if (p.postType === "CAROUSEL" && p.carouselGroupId) {
        if (seenCarousels.has(p.carouselGroupId)) return false;
        // Only show the first slide (order 0) as the representative
        const slides = carouselSlidesMap.get(p.carouselGroupId);
        if (slides && slides[0]?.id !== p.id) return false;
        seenCarousels.add(p.carouselGroupId);
      }
      return true;
    });
  }, [posts, carouselSlidesMap]);

  // Group display posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of displayPosts) {
      if (post.scheduledAt) {
        const dateKey = format(new Date(post.scheduledAt), "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(post);
      }
    }
    return map;
  }, [displayPosts]);

  function getCarouselSlides(post: Post): Post[] {
    if (post.postType === "CAROUSEL" && post.carouselGroupId) {
      return carouselSlidesMap.get(post.carouselGroupId) || [post];
    }
    return [post];
  }

  // Unscheduled posts (collapsed for carousels)
  const unscheduledPosts = displayPosts.filter((p) => !p.scheduledAt);
  const scheduledCount = displayPosts.filter((p) => p.scheduledAt).length;

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
                    const isCarousel = post.postType === "CAROUSEL";
                    const slides = isCarousel ? getCarouselSlides(post) : [];
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
                          {/* Type badge */}
                          <div className="absolute bottom-0.5 left-0.5">
                            {isCarousel ? (
                              <span className="bg-purple-500 text-white text-[9px] px-1 rounded font-medium">{slides.length} slides</span>
                            ) : isVideo ? (
                              <span className="bg-blue-500 text-white text-[9px] px-1 rounded font-medium">REEL</span>
                            ) : null}
                          </div>
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
              const isCarousel = post.postType === "CAROUSEL";
              const slides = isCarousel ? getCarouselSlides(post) : [];
              return (
                <button
                  key={post.id}
                  onClick={() => setPreviewPost(post)}
                  className="group relative rounded-lg border overflow-hidden aspect-square hover:shadow-md transition-all hover:scale-105"
                >
                  {isVideo ? (
                    <div className="flex h-full items-center justify-center bg-gray-900">
                      <Play className="h-5 w-5 text-white/60" />
                    </div>
                  ) : (
                    <img src={post.fileUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Type badge */}
                  <div className="absolute bottom-1 left-1">
                    {isCarousel ? (
                      <span className="bg-purple-500 text-white text-[9px] px-1.5 rounded font-medium">{slides.length} slides</span>
                    ) : isVideo ? (
                      <span className="bg-blue-500 text-white text-[9px] px-1.5 rounded font-medium">REEL</span>
                    ) : null}
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
          carouselSlides={getCarouselSlides(previewPost)}
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
