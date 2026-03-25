"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CalendarDays, Sparkles, Loader2, Plus, Upload, Clock,
  CheckCircle2, FileVideo, FileImage, Send, Layers,
  Play, ChevronUp, ChevronDown, X, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkUploader } from "@/components/content-scheduler/BulkUploader";
import { CalendarView } from "@/components/content-scheduler/CalendarView";
import { PostEditor } from "@/components/content-scheduler/PostEditor";

interface Client {
  id: string;
  name: string;
  brandProfile: any;
}

interface Batch {
  id: string;
  name: string;
  monthYear: string;
  status: string;
  totalPosts: number;
  brandContext: any;
  posts: any[];
}

export default function ContentSchedulerPage() {
  // State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("upload");

  // New batch form
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [batchMonth, setBatchMonth] = useState(format(new Date(), "yyyy-MM"));
  const [brandContext, setBrandContext] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);

  // Generation states
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  // Carousel grouping from content tab
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [groupingCarousel, setGroupingCarousel] = useState(false);

  // Load clients
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = data.clients || [];
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
      });
  }, []);

  // Load batches when client changes
  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/content-scheduler/batches?clientId=${selectedClient}`)
      .then((r) => r.json())
      .then((data) => {
        const batchList = data.batches || [];
        setBatches(batchList);
        if (batchList.length > 0) {
          setActiveBatch(batchList[0]);
          refreshPosts(batchList[0].id);
        } else {
          setActiveBatch(null);
          setPosts([]);
        }
      });
  }, [selectedClient]);

  function selectBatch(batch: Batch) {
    setActiveBatch(batch);
    // Always load fresh posts from DB to avoid stale data
    refreshPosts(batch.id);
  }

  async function refreshPosts(batchId: string) {
    const res = await fetch(`/api/content-scheduler/posts?batchId=${batchId}`);
    const data = await res.json();
    setPosts(data.posts || []);
  }

  async function createBatch() {
    if (!batchName || !batchMonth) return;
    setCreatingBatch(true);
    try {
      const res = await fetch("/api/content-scheduler/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          name: batchName,
          monthYear: batchMonth,
          brandContext: brandContext ? { context: brandContext } : null,
        }),
      });
      const data = await res.json();
      if (data.batch) {
        const newBatch = { ...data.batch, posts: [] };
        setBatches((prev) => [newBatch, ...prev]);
        selectBatch(newBatch);
        setShowNewBatch(false);
        setBatchName("");
        setBrandContext("");
        setActiveTab("upload");
      }
    } finally {
      setCreatingBatch(false);
    }
  }

  function handleUploadComplete(newPosts: any[]) {
    // Reload from DB to get complete, consistent data
    if (activeBatch) refreshPosts(activeBatch.id);
    setActiveTab("content");
  }

  async function generateAllCopy() {
    if (!activeBatch) return;
    // Send ALL post IDs (including carousel slides) that need copy
    const draftPosts = posts.filter((p) => !p.caption);
    if (draftPosts.length === 0) return;

    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/content-scheduler/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postIds: draftPosts.map((p) => p.id),
          brandContext: (activeBatch.brandContext as any)?.context || brandContext,
        }),
      });
      const data = await res.json();
      if (data.results) {
        const failures = data.results.filter((r: any) => !r.success);
        if (failures.length > 0) {
          console.error("Copy generation failures:", failures);
          alert(`${data.results.length - failures.length} captions generados, ${failures.length} fallaron: ${failures[0]?.error || "Error desconocido"}`);
        }
        // Reload from DB to get fresh data with generated copy
        if (activeBatch) await refreshPosts(activeBatch.id);
      } else if (data.error) {
        alert(`Error: ${data.error}`);
      }
    } finally {
      setGeneratingCopy(false);
    }
  }

  async function generateSchedule() {
    if (!activeBatch) return;
    setGeneratingSchedule(true);
    try {
      const res = await fetch("/api/content-scheduler/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: activeBatch.id,
          brandContext: (activeBatch.brandContext as any)?.context || brandContext,
        }),
      });
      const data = await res.json();
      if (data.posts || data.schedule) {
        // Reload from DB to get fresh scheduled posts with scheduledAt dates
        if (activeBatch) await refreshPosts(activeBatch.id);
        setActiveTab("calendar");
      }
    } finally {
      setGeneratingSchedule(false);
    }
  }

  async function handlePostUpdate(updatedPost: any) {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    setEditingPost(updatedPost);
    // Also refresh from DB to keep everything in sync
    if (activeBatch) refreshPosts(activeBatch.id);
  }

  function togglePostSelection(postId: string) {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  async function groupAsCarousel() {
    if (selectedPostIds.size < 2 || !activeBatch) return;
    setGroupingCarousel(true);
    try {
      const groupId = `carousel-${Date.now()}`;
      const ids = [...selectedPostIds];
      // Update each post to be part of the carousel
      for (let i = 0; i < ids.length; i++) {
        await fetch("/api/content-scheduler/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: ids[i],
            postType: "CAROUSEL",
            carouselGroupId: groupId,
            carouselOrder: i,
          }),
        });
      }
      await refreshPosts(activeBatch.id);
      setSelectedPostIds(new Set());
      setSelectMode(false);
    } finally {
      setGroupingCarousel(false);
    }
  }

  async function ungroupCarousel(carouselGroupId: string) {
    if (!activeBatch) return;
    const slides = posts.filter((p: any) => p.carouselGroupId === carouselGroupId);
    for (const slide of slides) {
      await fetch("/api/content-scheduler/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: slide.id,
          postType: "SINGLE",
          carouselGroupId: null,
          carouselOrder: null,
        }),
      });
    }
    await refreshPosts(activeBatch.id);
  }

  async function moveCarouselSlide(carouselGroupId: string, postId: string, direction: "up" | "down") {
    if (!activeBatch) return;
    const slides = posts
      .filter((p: any) => p.carouselGroupId === carouselGroupId)
      .sort((a: any, b: any) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0));
    const idx = slides.findIndex((s: any) => s.id === postId);
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= slides.length) return;
    // Swap orders
    await Promise.all([
      fetch("/api/content-scheduler/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: slides[idx].id, carouselOrder: newIdx }),
      }),
      fetch("/api/content-scheduler/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: slides[newIdx].id, carouselOrder: idx }),
      }),
    ]);
    await refreshPosts(activeBatch.id);
  }

  async function handlePostDelete(postId: string) {
    await fetch("/api/content-scheduler/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setEditingPost(null);
  }

  async function handlePostReschedule(postId: string, newDate: string, time: string) {
    const scheduledAt = new Date(`${newDate}T${time}:00`).toISOString();
    await fetch("/api/content-scheduler/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId,
        scheduledAt,
        status: "SCHEDULED",
      }),
    });
    // For carousel posts, also reschedule all slides in the group
    const post = posts.find((p: any) => p.id === postId);
    if (post?.postType === "CAROUSEL" && post?.carouselGroupId) {
      const slides = posts.filter(
        (p: any) => p.carouselGroupId === post.carouselGroupId && p.id !== postId
      );
      for (const slide of slides) {
        await fetch("/api/content-scheduler/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: slide.id,
            scheduledAt,
            status: "SCHEDULED",
          }),
        });
      }
    }
    if (activeBatch) await refreshPosts(activeBatch.id);
  }

  async function handlePublish(postId: string) {
    const res = await fetch("/api/content-scheduler/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    if (data.post) {
      handlePostUpdate(data.post);
    }
  }

  // Collapse carousel slides into display posts (one entry per carousel)
  const displayPosts = (() => {
    const seenCarousels = new Set<string>();
    return posts.filter((p) => {
      if (p.postType === "CAROUSEL" && p.carouselGroupId) {
        if (seenCarousels.has(p.carouselGroupId)) return false;
        seenCarousels.add(p.carouselGroupId);
      }
      return true;
    });
  })();

  // Get carousel slides for a post
  function getCarouselSlides(post: any): any[] {
    if (post.postType === "CAROUSEL" && post.carouselGroupId) {
      return posts
        .filter((p: any) => p.carouselGroupId === post.carouselGroupId)
        .sort((a: any, b: any) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0));
    }
    return [post];
  }

  // Stats based on display posts (collapsed carousels)
  const stats = {
    total: displayPosts.length,
    draft: displayPosts.filter((p) => p.status === "DRAFT").length,
    scheduled: displayPosts.filter((p) => p.status === "SCHEDULED").length,
    posted: displayPosts.filter((p) => p.status === "POSTED").length,
    failed: displayPosts.filter((p) => p.status === "FAILED").length,
    withCopy: displayPosts.filter((p) => p.caption).length,
    reels: displayPosts.filter((p) => p.fileType.startsWith("video")).length,
    images: displayPosts.filter((p) => !p.fileType.startsWith("video") && p.postType !== "CAROUSEL").length,
    carousels: displayPosts.filter((p) => p.postType === "CAROUSEL").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Content Scheduler</h2>
          <p className="text-muted-foreground">Sube contenido, genera copy con AI, y programa tu calendario mensual</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-52">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedClient && (
        <div className="flex gap-6">
          {/* Left sidebar — Batches */}
          <div className="w-64 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Lotes de contenido</h3>
              <Button size="sm" variant="outline" onClick={() => setShowNewBatch(true)}>
                <Plus className="h-3 w-3 mr-1" />Nuevo
              </Button>
            </div>

            {/* New batch form */}
            {showNewBatch && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <Input
                  placeholder="Nombre del lote"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                />
                <Input
                  type="month"
                  value={batchMonth}
                  onChange={(e) => setBatchMonth(e.target.value)}
                />
                <textarea
                  placeholder="Contexto de la marca (tono, estilo, objetivos del mes...)"
                  value={brandContext}
                  onChange={(e) => setBrandContext(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={createBatch} disabled={creatingBatch || !batchName} className="flex-1">
                    {creatingBatch ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewBatch(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Batch list */}
            <div className="space-y-1">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => selectBatch(batch)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    activeBatch?.id === batch.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium truncate">{batch.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span>{batch.monthYear}</span>
                    <span>·</span>
                    <span>{batch.totalPosts} posts</span>
                  </div>
                  <Badge variant="outline" className="mt-1 text-xs">{batch.status}</Badge>
                </button>
              ))}
              {batches.length === 0 && !showNewBatch && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No hay lotes. Crea uno para empezar.
                </p>
              )}
            </div>
          </div>

          {/* Main content */}
          {activeBatch ? (
            <div className="flex-1 min-w-0">
              {/* Stats bar */}
              <div className="grid grid-cols-6 gap-3 mb-4">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.images}</p>
                  <p className="text-xs text-muted-foreground">Imagenes</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.reels}</p>
                  <p className="text-xs text-muted-foreground">Reels</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.carousels}</p>
                  <p className="text-xs text-muted-foreground">Carruseles</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.withCopy}</p>
                  <p className="text-xs text-muted-foreground">Con copy</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.posted}</p>
                  <p className="text-xs text-muted-foreground">Publicados</p>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="upload">
                      <Upload className="mr-1 h-4 w-4" />Subir
                    </TabsTrigger>
                    <TabsTrigger value="content">
                      <FileImage className="mr-1 h-4 w-4" />Contenido ({stats.total})
                    </TabsTrigger>
                    <TabsTrigger value="calendar">
                      <CalendarDays className="mr-1 h-4 w-4" />Calendario
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex gap-2">
                    {stats.total > 0 && stats.withCopy < stats.total && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generateAllCopy}
                        disabled={generatingCopy}
                      >
                        {generatingCopy ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generando copy...</>
                        ) : (
                          <><Sparkles className="mr-1 h-3 w-3" />Generar todo el copy ({stats.total - stats.withCopy})</>
                        )}
                      </Button>
                    )}
                    {stats.withCopy > 0 && stats.scheduled < stats.total && (
                      <Button
                        size="sm"
                        onClick={generateSchedule}
                        disabled={generatingSchedule}
                      >
                        {generatingSchedule ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generando calendario...</>
                        ) : (
                          <><CalendarDays className="mr-1 h-3 w-3" />Generar calendario</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Upload tab */}
                <TabsContent value="upload">
                  <div className="rounded-lg border bg-card p-6">
                    <BulkUploader
                      clientId={selectedClient}
                      batchId={activeBatch.id}
                      onUploadComplete={handleUploadComplete}
                    />
                  </div>
                </TabsContent>

                {/* Content tab */}
                <TabsContent value="content">
                  {displayPosts.length === 0 ? (
                    <div className="rounded-lg border bg-card p-12 text-center">
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No hay contenido aun. Sube archivos en la pestana "Subir".</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selection toolbar */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={selectMode ? "default" : "outline"}
                          onClick={() => {
                            setSelectMode(!selectMode);
                            setSelectedPostIds(new Set());
                          }}
                        >
                          <Layers className="mr-1 h-3 w-3" />
                          {selectMode ? "Cancelar seleccion" : "Crear carrusel"}
                        </Button>
                        {selectMode && selectedPostIds.size >= 2 && (
                          <Button
                            size="sm"
                            onClick={groupAsCarousel}
                            disabled={groupingCarousel}
                          >
                            {groupingCarousel ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Layers className="mr-1 h-3 w-3" />
                            )}
                            Agrupar {selectedPostIds.size} fotos en carrusel
                          </Button>
                        )}
                        {selectMode && (
                          <span className="text-xs text-muted-foreground">
                            Selecciona 2+ imagenes para agrupar
                          </span>
                        )}
                      </div>

                      {/* Content grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayPosts.map((post) => {
                          const isCarousel = post.postType === "CAROUSEL";
                          const isVideo = post.fileType.startsWith("video");
                          const slides = isCarousel ? getCarouselSlides(post) : [];
                          const isSelected = selectedPostIds.has(post.id);
                          const canSelect = selectMode && !isVideo && !isCarousel;

                          return (
                            <div key={post.id} className="space-y-0">
                              <button
                                onClick={() => {
                                  if (canSelect) {
                                    togglePostSelection(post.id);
                                  } else if (!selectMode) {
                                    setEditingPost(post);
                                  }
                                }}
                                className={`group w-full rounded-lg border bg-card overflow-hidden text-left transition-all hover:shadow-lg ${
                                  isSelected ? "ring-2 ring-primary border-primary" : ""
                                } ${selectMode && !canSelect ? "opacity-50" : ""}`}
                              >
                                {/* Thumbnail */}
                                <div className="relative aspect-square bg-muted">
                                  {isVideo ? (
                                    <div className="relative h-full bg-black">
                                      <video
                                        src={post.fileUrl}
                                        className="h-full w-full object-cover"
                                        muted
                                        preload="metadata"
                                      />
                                      {/* Play button overlay */}
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-white/90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                                          <Play className="h-6 w-6 text-gray-900 ml-0.5" />
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <img
                                      src={post.fileUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  )}
                                  {/* Selection checkbox */}
                                  {canSelect && (
                                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isSelected ? "bg-primary border-primary text-white" : "bg-white/80 border-gray-300"
                                    }`}>
                                      {isSelected && <span className="text-xs font-bold">✓</span>}
                                    </div>
                                  )}
                                  {/* Type badge */}
                                  {!selectMode && (
                                    <div className="absolute top-2 left-2">
                                      {isCarousel ? (
                                        <Badge className="bg-purple-500 text-white text-xs">{slides.length} slides</Badge>
                                      ) : isVideo ? (
                                        <Badge className="bg-blue-500 text-white text-xs">Reel</Badge>
                                      ) : null}
                                    </div>
                                  )}
                                  {/* Status badge */}
                                  <div className="absolute top-2 right-2">
                                    {post.status === "POSTED" && (
                                      <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
                                    )}
                                    {post.status === "SCHEDULED" && (
                                      <Clock className="h-5 w-5 text-blue-500 drop-shadow" />
                                    )}
                                    {post.status === "FAILED" && (
                                      <Badge variant="destructive" className="text-xs">Error</Badge>
                                    )}
                                  </div>
                                  {/* Carousel slide strip at bottom */}
                                  {isCarousel && slides.length > 1 && (
                                    <div className="absolute bottom-0 inset-x-0 flex gap-0.5 p-1 bg-gradient-to-t from-black/50">
                                      {slides.slice(0, 5).map((slide: any) => (
                                        <div key={slide.id} className="h-6 flex-1 rounded-sm overflow-hidden border border-white/30">
                                          <img src={slide.fileUrl} alt="" className="h-full w-full object-cover" />
                                        </div>
                                      ))}
                                      {slides.length > 5 && (
                                        <div className="h-6 flex-1 rounded-sm bg-black/50 flex items-center justify-center">
                                          <span className="text-white text-[9px]">+{slides.length - 5}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* Info */}
                                <div className="p-2">
                                  {post.userContext && (
                                    <p className="text-[10px] text-amber-600 truncate mb-0.5">{post.userContext}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground truncate">
                                    {post.caption ? post.caption.substring(0, 60) + "..." : "Sin caption"}
                                  </p>
                                  {post.scheduledAt && (
                                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(post.scheduledAt), "dd MMM HH:mm")}
                                    </p>
                                  )}
                                </div>
                              </button>

                              {/* Carousel management strip */}
                              {isCarousel && !selectMode && (
                                <div className="rounded-b-lg border border-t-0 bg-purple-50 p-2">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-medium text-purple-700">
                                      Carrusel · {slides.length} slides
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (post.carouselGroupId) ungroupCarousel(post.carouselGroupId);
                                      }}
                                      className="text-[10px] text-purple-500 hover:text-red-500 transition-colors"
                                    >
                                      Desagrupar
                                    </button>
                                  </div>
                                  <div className="flex gap-1 overflow-x-auto pb-1">
                                    {slides.map((slide: any, idx: number) => (
                                      <div key={slide.id} className="relative shrink-0 w-10 h-10 rounded overflow-hidden border group/slide">
                                        <img src={slide.fileUrl} alt="" className="h-full w-full object-cover" />
                                        <span className="absolute top-0 left-0 bg-purple-600 text-white text-[8px] px-1 rounded-br font-bold">
                                          {idx + 1}
                                        </span>
                                        <div className="absolute bottom-0 inset-x-0 flex justify-center gap-px opacity-0 group-hover/slide:opacity-100 transition-opacity bg-black/40">
                                          {idx > 0 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (post.carouselGroupId) moveCarouselSlide(post.carouselGroupId, slide.id, "up");
                                              }}
                                              className="text-white p-0.5"
                                            >
                                              <ChevronUp className="h-2.5 w-2.5 -rotate-90" />
                                            </button>
                                          )}
                                          {idx < slides.length - 1 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (post.carouselGroupId) moveCarouselSlide(post.carouselGroupId, slide.id, "down");
                                              }}
                                              className="text-white p-0.5"
                                            >
                                              <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Calendar tab */}
                <TabsContent value="calendar">
                  <CalendarView
                    posts={posts}
                    monthYear={activeBatch.monthYear}
                    onPostClick={(post) => setEditingPost(post)}
                    onPostReschedule={handlePostReschedule}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-lg border bg-card p-12">
              <div className="text-center">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-lg font-medium">Selecciona o crea un lote</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea un nuevo lote de contenido para empezar a planificar tu mes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post editor modal */}
      {editingPost && (
        <PostEditor
          post={editingPost}
          carouselSlides={getCarouselSlides(editingPost)}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
          onPublish={handlePublish}
          onClose={() => setEditingPost(null)}
        />
      )}
    </div>
  );
}
