"use client";

import { useMemo, useState, useCallback, DragEvent } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isToday, isBefore, addMonths, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  FileVideo, FileImage, Clock, CheckCircle2, AlertCircle,
  Send, Play, X, Eye, ChevronLeft, ChevronRight, Layers, GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  onPostReschedule?: (postId: string, newDate: string, time: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  POSTED: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  POSTED: "Publicado",
  FAILED: "Fallo",
};

// Quick preview overlay
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
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-black">
          {currentMedia.fileType.startsWith("video") ? (
            <video
              key={currentMedia.id}
              src={currentMedia.fileUrl}
              controls
              autoPlay
              muted
              className="w-full max-h-[450px] object-contain"
            />
          ) : (
            <img
              key={currentMedia.id}
              src={currentMedia.fileUrl}
              alt=""
              className="w-full max-h-[450px] object-contain"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute top-2 left-2">
            {isCarousel ? (
              <Badge className="bg-purple-500 text-white">Carrusel {activeSlide + 1}/{carouselSlides.length}</Badge>
            ) : post.fileType.startsWith("video") ? (
              <Badge className="bg-blue-500 text-white">Reel</Badge>
            ) : null}
          </div>
          {isCarousel && (
            <>
              {activeSlide > 0 && (
                <button onClick={() => setActiveSlide((s) => s - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70">‹</button>
              )}
              {activeSlide < carouselSlides.length - 1 && (
                <button onClick={() => setActiveSlide((s) => s + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70">›</button>
              )}
            </>
          )}
        </div>
        {isCarousel && (
          <div className="flex gap-1 px-4 py-2 overflow-x-auto bg-muted/30">
            {carouselSlides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlide(i)}
                className={`relative shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                  i === activeSlide ? "border-primary" : "border-transparent opacity-60"
                }`}
              >
                <img src={slide.fileUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge className={STATUS_COLORS[post.status]}>{STATUS_LABELS[post.status] || post.status}</Badge>
            {post.scheduledAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(post.scheduledAt), "dd MMM yyyy · h:mm a", { locale: es })}
              </span>
            )}
          </div>
          {post.userContext && (
            <div className="rounded bg-amber-50 border border-amber-200 px-3 py-1.5">
              <p className="text-xs text-amber-800"><span className="font-medium">Contexto:</span> {post.userContext}</p>
            </div>
          )}
          {post.caption ? (
            <p className="text-sm leading-relaxed whitespace-pre-line line-clamp-4">{post.caption}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin caption</p>
          )}
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

export function CalendarView({ posts, monthYear, onPostClick, onPostReschedule }: CalendarViewProps) {
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Dynamic month navigation — start from batch month but allow navigating
  const [baseYear, baseMonth] = monthYear.split("-").map(Number);
  const [monthOffset, setMonthOffset] = useState(0);
  const currentDate = addMonths(new Date(baseYear, baseMonth - 1), monthOffset);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth]);

  // Carousel grouping
  const carouselSlidesMap = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (post.postType === "CAROUSEL" && post.carouselGroupId) {
        const group = map.get(post.carouselGroupId) || [];
        group.push(post);
        map.set(post.carouselGroupId, group);
      }
    }
    for (const [, slides] of map) {
      slides.sort((a, b) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0));
    }
    return map;
  }, [posts]);

  const displayPosts = useMemo(() => {
    const seenCarousels = new Set<string>();
    return posts.filter((p) => {
      if (p.postType === "CAROUSEL" && p.carouselGroupId) {
        if (seenCarousels.has(p.carouselGroupId)) return false;
        const slides = carouselSlidesMap.get(p.carouselGroupId);
        if (slides && slides[0]?.id !== p.id) return false;
        seenCarousels.add(p.carouselGroupId);
      }
      return true;
    });
  }, [posts, carouselSlidesMap]);

  // Group by date — include ALL months, not just current
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

  const unscheduledPosts = displayPosts.filter((p) => !p.scheduledAt);
  const scheduledCount = displayPosts.filter((p) => p.scheduledAt).length;

  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const firstDayOffset = days.length > 0 ? (getDay(days[0]) + 6) % 7 : 0;

  // Drag and drop handlers
  function handleDragStart(e: DragEvent, post: Post) {
    e.dataTransfer.setData("text/plain", post.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  }

  function handleDragLeave() {
    setDragOverDate(null);
  }

  function handleDrop(e: DragEvent, dateKey: string) {
    e.preventDefault();
    setDragOverDate(null);
    const postId = e.dataTransfer.getData("text/plain");
    if (!postId || !onPostReschedule) return;

    // Find the post to get its current time, or default to 10:00
    const post = displayPosts.find((p) => p.id === postId);
    const time = post?.scheduledAt
      ? format(new Date(post.scheduledAt), "HH:mm") // keep 24h for the API
      : "10:00";

    onPostReschedule(postId, dateKey, time);
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold capitalize min-w-[180px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {monthOffset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)} className="text-xs">
              Volver a {format(new Date(baseYear, baseMonth - 1), "MMM yyyy", { locale: es })}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{scheduledCount} programado{scheduledCount !== 1 ? "s" : ""}</span>
          {unscheduledPosts.length > 0 && (
            <span className="text-amber-600">{unscheduledPosts.length} sin fecha</span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[140px] border-b border-r bg-muted/10" />
          ))}

          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDate[dateKey] || [];
            const past = isBefore(day, new Date()) && !isToday(day);
            const isDragOver = dragOverDate === dateKey;

            return (
              <div
                key={dateKey}
                className={`min-h-[140px] border-b border-r p-1 transition-colors ${
                  isDragOver ? "bg-primary/10 ring-2 ring-inset ring-primary/30" :
                  isToday(day) ? "bg-primary/5" : past ? "bg-muted/20" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, dateKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateKey)}
              >
                <div className={`text-xs font-medium mb-1 px-1 ${
                  isToday(day) ? "text-primary font-bold" : past ? "text-muted-foreground" : ""
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1.5">
                  {dayPosts.map((post) => {
                    const isVideo = post.fileType.startsWith("video");
                    const isCarousel = post.postType === "CAROUSEL";
                    const slides = isCarousel ? getCarouselSlides(post) : [];

                    return (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, post)}
                        onClick={() => setPreviewPost(post)}
                        className={`rounded overflow-hidden border cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:scale-[1.02] ${STATUS_COLORS[post.status]}`}
                      >
                        {/* Bigger thumbnail */}
                        <div className="relative w-full h-20 bg-muted">
                          {isVideo ? (
                            <div className="relative h-full bg-black">
                              <video
                                src={post.fileUrl}
                                className="h-full w-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/80 rounded-full p-1.5">
                                  <Play className="h-3.5 w-3.5 text-gray-900 ml-0.5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={post.fileUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                          {/* Type badge */}
                          <div className="absolute bottom-0.5 left-0.5">
                            {isCarousel ? (
                              <span className="bg-purple-500 text-white text-[8px] px-1 rounded font-medium">{slides.length} slides</span>
                            ) : isVideo ? (
                              <span className="bg-blue-500 text-white text-[8px] px-1 rounded font-medium">REEL</span>
                            ) : null}
                          </div>
                          {/* Drag handle */}
                          <div className="absolute top-0.5 right-0.5 opacity-0 hover:opacity-100 transition-opacity">
                            <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
                          </div>
                        </div>
                        {/* Time + caption */}
                        <div className="px-1.5 py-1">
                          <div className="flex items-center gap-1 text-[11px]">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            <span className="font-medium">
                              {post.scheduledAt ? format(new Date(post.scheduledAt), "h:mm a") : ""}
                            </span>
                          </div>
                          {post.caption && (
                            <p className="truncate text-[10px] leading-tight opacity-70 mt-0.5">
                              {post.caption.substring(0, 50)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled posts — draggable to calendar */}
      {unscheduledPosts.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-1">
            Sin programar ({unscheduledPosts.length})
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Arrastra al calendario para programar
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {unscheduledPosts.map((post) => {
              const isVideo = post.fileType.startsWith("video");
              const isCarousel = post.postType === "CAROUSEL";
              const slides = isCarousel ? getCarouselSlides(post) : [];
              return (
                <div
                  key={post.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, post)}
                  onClick={() => setPreviewPost(post)}
                  className="group relative rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all hover:scale-105"
                >
                  <div className="aspect-square bg-muted">
                    {isVideo ? (
                      <div className="relative h-full bg-black">
                        <video
                          src={post.fileUrl}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/80 rounded-full p-2">
                            <Play className="h-4 w-4 text-gray-900 ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img src={post.fileUrl} alt="" className="h-full w-full object-cover" />
                    )}
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
                  {/* Drag hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <GripVertical className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                  </div>
                </div>
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
