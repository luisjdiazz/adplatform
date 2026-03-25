"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CalendarDays, Sparkles, Loader2, Plus, Upload, Clock,
  CheckCircle2, FileVideo, FileImage, Send,
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
        // Reload from DB to get fresh data with generated copy
        if (activeBatch) await refreshPosts(activeBatch.id);
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

  async function handlePostDelete(postId: string) {
    await fetch("/api/content-scheduler/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setEditingPost(null);
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {displayPosts.map((post) => {
                        const isCarousel = post.postType === "CAROUSEL";
                        const slides = isCarousel ? getCarouselSlides(post) : [];
                        return (
                          <button
                            key={post.id}
                            onClick={() => setEditingPost(post)}
                            className="group rounded-lg border bg-card overflow-hidden text-left transition-all hover:shadow-lg hover:scale-[1.02]"
                          >
                            {/* Thumbnail */}
                            <div className="relative aspect-square bg-muted">
                              {post.fileType.startsWith("video") ? (
                                <div className="flex h-full items-center justify-center bg-gray-900">
                                  <FileVideo className="h-8 w-8 text-white/60" />
                                </div>
                              ) : (
                                <img
                                  src={post.fileUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              )}
                              {/* Type badge */}
                              <div className="absolute top-2 left-2">
                                {isCarousel ? (
                                  <Badge className="bg-purple-500 text-white text-xs">{slides.length} slides</Badge>
                                ) : post.fileType.startsWith("video") ? (
                                  <Badge className="bg-blue-500 text-white text-xs">Reel</Badge>
                                ) : null}
                              </div>
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
                                  {slides.slice(0, 5).map((slide: any, i: number) => (
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
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Calendar tab */}
                <TabsContent value="calendar">
                  <CalendarView
                    posts={posts}
                    monthYear={activeBatch.monthYear}
                    onPostClick={(post) => setEditingPost(post)}
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
