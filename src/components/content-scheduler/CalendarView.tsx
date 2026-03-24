"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { FileVideo, FileImage, Clock, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Post {
  id: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
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

export function CalendarView({ posts, monthYear, onPostClick }: CalendarViewProps) {
  const [year, month] = monthYear.split("-").map(Number);
  const monthDate = new Date(year, month - 1);

  const days = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

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

  // Day of week headers
  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  // Offset for first day (Monday = 0)
  const firstDayOffset = (getDay(days[0]) + 6) % 7;

  return (
    <div className="space-y-4">
      {/* Month header */}
      <h3 className="text-lg font-semibold capitalize">
        {format(monthDate, "MMMM yyyy", { locale: es })}
      </h3>

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
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r bg-muted/10" />
          ))}

          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDate[dateKey] || [];
            const past = isBefore(day, new Date()) && !isToday(day);

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] border-b border-r p-1 ${
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
                    return (
                      <button
                        key={post.id}
                        onClick={() => onPostClick(post)}
                        className={`w-full rounded px-1.5 py-1 text-left text-xs border transition-colors hover:opacity-80 ${STATUS_COLORS[post.status]}`}
                      >
                        <div className="flex items-center gap-1">
                          {post.fileType.startsWith("video") ? (
                            <FileVideo className="h-3 w-3 shrink-0" />
                          ) : (
                            <FileImage className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate flex-1">
                            {post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : ""}
                          </span>
                          <StatusIcon className="h-3 w-3 shrink-0" />
                        </div>
                        {post.caption && (
                          <p className="truncate mt-0.5 opacity-75">
                            {post.caption.substring(0, 30)}
                          </p>
                        )}
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
          <h4 className="text-sm font-medium mb-2">
            Sin programar ({unscheduledPosts.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {unscheduledPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => onPostClick(post)}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                {post.fileType.startsWith("video") ? (
                  <FileVideo className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileImage className="h-4 w-4 text-green-500" />
                )}
                <span>{post.caption ? post.caption.substring(0, 40) + "..." : "Sin caption"}</span>
                <Badge variant="outline" className="text-xs">
                  {post.status}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
