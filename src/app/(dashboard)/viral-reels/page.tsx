"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Flame, Search, Sparkles, Eye, Heart, MessageCircle, Share2, Clock, Music, ExternalLink, Loader2, TrendingUp, Lightbulb, Play, ChevronDown, ChevronUp, Trash2, RefreshCw } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface ReelScan {
  id: string;
  niche: string;
  hashtags: string[];
  status: string;
  totalReels: number;
  aiSummary: any;
  clientId: string | null;
  client: { id: string; name: string } | null;
  createdAt: string;
  _count: { reels: number };
}

interface ViralReel {
  id: string;
  contentType: string;
  instagramUrl: string;
  shortcode: string | null;
  ownerUsername: string | null;
  caption: string | null;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  sharesCount: number;
  duration: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaUrls: string[];
  musicName: string | null;
  hashtags: string[];
  postedAt: string | null;
  aiAnalysis: any;
}

const NICHE_OPTIONS = [
  { value: "amazon-affiliate", label: "Amazon Affiliate" },
  { value: "amazon-finds", label: "Amazon Finds" },
  { value: "fashion", label: "Fashion" },
  { value: "clothes-store", label: "Clothes Store" },
  { value: "hair-salon", label: "Hair Salon" },
  { value: "real-estate", label: "Real Estate" },
];

function InstagramEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Instagram embed script if not already loaded
    const scriptId = "instagram-embed-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      document.body.appendChild(script);
      script.onload = () => {
        (window as any).instgrm?.Embeds?.process();
      };
    } else {
      // Script already loaded, just process new embeds
      setTimeout(() => {
        (window as any).instgrm?.Embeds?.process();
      }, 100);
    }
  }, [url]);

  return (
    <div ref={containerRef} className="flex justify-center overflow-auto p-2">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          maxWidth: "540px",
          width: "100%",
          minWidth: "326px",
          background: "#000",
          border: "0",
          margin: "0",
          padding: "0",
        }}
      />
    </div>
  );
}

export default function ViralContentPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [scans, setScans] = useState<ReelScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<ReelScan | null>(null);
  const [reels, setReels] = useState<ViralReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [remixLoading, setRemixLoading] = useState<string | null>(null);
  const [activeRemix, setActiveRemix] = useState<{ reelId: string; data: any } | null>(null);

  // New scan form
  const [selectedNiche, setSelectedNiche] = useState("");
  const [extraAccounts, setExtraAccounts] = useState("");
  const [maxResults, setMaxResults] = useState(30);

  // Content type filter
  const [contentFilter, setContentFilter] = useState<"ALL" | "REEL" | "POST" | "CAROUSEL">("ALL");

  // AI Summary expansion
  const [showAiSummary, setShowAiSummary] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // Load clients and scans on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = data.clients || [];
        setClients(list);
      });
    loadScans();
  }, []);

  const loadScans = useCallback(async () => {
    const res = await fetch("/api/viral-reels/scans");
    const data = await res.json();
    setScans(data.scans || []);
  }, []);

  // Poll for active scans
  useEffect(() => {
    const activeScans = scans.filter(
      (s) => s.status === "SCRAPING" || s.status === "ANALYZING"
    );
    if (activeScans.length === 0) return;

    const interval = setInterval(() => {
      loadScans();
    }, 5000);
    return () => clearInterval(interval);
  }, [scans, loadScans]);

  const startScan = async () => {
    if (!selectedNiche) return;
    setScanLoading(true);
    try {
      const extra = extraAccounts
        .split(",")
        .map((a) => a.trim().replace("@", ""))
        .filter(Boolean);

      const res = await fetch("/api/viral-reels/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: selectedNiche,
          extraAccounts: extra,
          clientId: selectedClient || undefined,
          maxResults,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error al iniciar scan");
        return;
      }

      await loadScans();
      setActiveTab("history");
      setExtraAccounts("");
    } catch (err) {
      alert("Error de conexion");
    } finally {
      setScanLoading(false);
    }
  };

  const loadScanDetail = async (scan: ReelScan) => {
    setLoading(true);
    setSelectedScan(scan);
    setShowAiSummary(false);
    setActiveRemix(null);
    try {
      const res = await fetch(`/api/viral-reels/scans/${scan.id}`);
      const data = await res.json();
      setReels(data.scan?.reels || []);
      // Update the scan with full data including aiSummary
      if (data.scan) {
        setSelectedScan(data.scan);
      }
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteScan = async (scanId: string) => {
    if (!confirm("Eliminar este scan y todos sus reels?")) return;
    await fetch(`/api/viral-reels/scans/${scanId}`, { method: "DELETE" });
    if (selectedScan?.id === scanId) {
      setSelectedScan(null);
      setReels([]);
    }
    loadScans();
  };

  const remixReel = async (reelId: string) => {
    setRemixLoading(reelId);
    try {
      const res = await fetch("/api/viral-reels/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reelId,
          clientId: selectedClient || selectedScan?.clientId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error al generar remix");
        return;
      }

      const data = await res.json();
      setActiveRemix({ reelId, data: data.remix });
    } catch {
      alert("Error de conexion");
    } finally {
      setRemixLoading(null);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
  };

  const getEngagementRate = (reel: ViralReel) => {
    if (!reel.viewsCount) return 0;
    return (
      ((reel.likesCount + reel.commentsCount + reel.sharesCount) /
        reel.viewsCount) *
      100
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-yellow-500/20 text-yellow-400",
      SCRAPING: "bg-blue-500/20 text-blue-400",
      ANALYZING: "bg-purple-500/20 text-purple-400",
      COMPLETED: "bg-green-500/20 text-green-400",
      FAILED: "bg-red-500/20 text-red-400",
    };
    return styles[status] || "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="h-8 w-8 text-orange-500" />
          <div>
            <h2 className="text-3xl font-bold">Viral Content Maker</h2>
            <p className="text-sm text-muted-foreground">
              Scrape trending reels, analyze patterns, remix for your brand
            </p>
          </div>
        </div>
        <div className="w-64">
          <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Todos / General" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos / General</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("new")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "new"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="mr-2 inline h-4 w-4" />
          Nuevo Scan
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="mr-2 inline h-4 w-4" />
          Historial ({scans.length})
        </button>
      </div>

      {/* New Scan Tab */}
      {activeTab === "new" && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Buscar Contenido Viral</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nicho</Label>
              <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona nicho" />
                </SelectTrigger>
                <SelectContent>
                  {NICHE_OPTIONS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Cuentas extra (separadas por coma)
              </Label>
              <Input
                placeholder="ej: @fashionnova, @revolve"
                value={extraAccounts}
                onChange={(e) => setExtraAccounts(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max resultados</Label>
              <Select
                value={maxResults.toString()}
                onValueChange={(v) => setMaxResults(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 posts</SelectItem>
                  <SelectItem value="30">30 posts</SelectItem>
                  <SelectItem value="50">50 posts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <button
                onClick={startScan}
                disabled={!selectedNiche || scanLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {scanLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {scanLoading ? "Escaneando..." : "Iniciar Scan"}
              </button>
            </div>
          </div>
          {selectedNiche && (
            <p className="mt-3 text-xs text-muted-foreground">
              Escaneando las cuentas mas virales del nicho{" "}
              <span className="font-medium text-orange-400">
                {NICHE_OPTIONS.find((n) => n.value === selectedNiche)?.label || selectedNiche}
              </span>
              {extraAccounts.trim() && " + cuentas extra"}
            </p>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {scans.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <Flame className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                No hay scans aun. Inicia uno en la pestana &quot;Nuevo Scan&quot;.
              </p>
            </div>
          ) : (
            scans.map((scan) => (
              <div
                key={scan.id}
                className={`flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:border-orange-500/30 ${
                  selectedScan?.id === scan.id ? "border-orange-500 ring-1 ring-orange-500/20" : ""
                }`}
              >
                <button
                  onClick={() => loadScanDetail(scan)}
                  className="flex flex-1 items-center gap-4 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{scan.niche}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(
                          scan.status
                        )}`}
                      >
                        {scan.status === "SCRAPING" || scan.status === "ANALYZING" ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {scan.status}
                          </span>
                        ) : (
                          scan.status
                        )}
                      </span>
                      {scan.client && (
                        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                          {scan.client.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scan._count?.reels || scan.totalReels} reels encontrados
                      {" · "}
                      {new Date(scan.createdAt).toLocaleDateString("es-DO", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => deleteScan(scan.id)}
                  className="ml-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected Scan Detail */}
      {selectedScan && selectedScan.status === "COMPLETED" && (
        <div className="space-y-6">
          {/* AI Summary */}
          {selectedScan.aiSummary && (
            <div className="rounded-xl border border-purple-500/20 bg-card p-6">
              <button
                onClick={() => setShowAiSummary(!showAiSummary)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-semibold">AI Analysis</h3>
                </div>
                {showAiSummary ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {showAiSummary && (
                <div className="mt-4 space-y-4">
                  {/* Summary */}
                  {selectedScan.aiSummary.resumen && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selectedScan.aiSummary.resumen}
                    </p>
                  )}

                  {/* Viral Patterns */}
                  {selectedScan.aiSummary.patrones_virales?.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        Patrones Virales
                      </h4>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedScan.aiSummary.patrones_virales.map(
                          (p: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg bg-green-500/5 p-3"
                            >
                              <p className="text-sm font-medium">{p.patron}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {p.descripcion}
                              </p>
                              {p.frecuencia && (
                                <p className="mt-1 text-xs text-green-400">
                                  {p.frecuencia}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Effective Hooks */}
                  {selectedScan.aiSummary.hooks_efectivos?.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Lightbulb className="h-4 w-4 text-yellow-400" />
                        Hooks Efectivos
                      </h4>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedScan.aiSummary.hooks_efectivos.map(
                          (h: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg bg-yellow-500/5 p-3"
                            >
                              <p className="text-sm font-medium">{h.tipo}</p>
                              <p className="mt-1 text-xs italic text-muted-foreground">
                                &quot;{h.ejemplo}&quot;
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content Recommendations */}
                  {selectedScan.aiSummary.recomendaciones_contenido?.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Play className="h-4 w-4 text-orange-400" />
                        Ideas de Contenido
                      </h4>
                      <div className="grid gap-2">
                        {selectedScan.aiSummary.recomendaciones_contenido.map(
                          (r: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg bg-orange-500/5 p-3"
                            >
                              <p className="text-sm font-medium">{r.idea}</p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {r.formato && (
                                  <span className="rounded bg-muted px-2 py-0.5">
                                    {r.formato}
                                  </span>
                                )}
                                {r.mejor_horario && (
                                  <span className="rounded bg-muted px-2 py-0.5">
                                    {r.mejor_horario}
                                  </span>
                                )}
                              </div>
                              {r.hook && (
                                <p className="mt-1 text-xs italic text-orange-400">
                                  Hook: &quot;{r.hook}&quot;
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Benchmarks */}
                  {selectedScan.aiSummary.metricas_benchmark && (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Object.entries(selectedScan.aiSummary.metricas_benchmark).map(
                        ([key, value]: [string, any]) => (
                          <div
                            key={key}
                            className="rounded-lg bg-muted/50 p-3 text-center"
                          >
                            <p className="text-lg font-bold">
                              {typeof value === "number"
                                ? formatNumber(value)
                                : value}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {key.replace(/_/g, " ")}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Top Hashtags & Music */}
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedScan.aiSummary.hashtags_top?.length > 0 && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          TOP HASHTAGS
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedScan.aiSummary.hashtags_top.map(
                            (h: string, i: number) => (
                              <span
                                key={i}
                                className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
                              >
                                #{h.replace("#", "")}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                    {selectedScan.aiSummary.musica_trending?.length > 0 && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          MUSICA TRENDING
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedScan.aiSummary.musica_trending.map(
                            (m: string, i: number) => (
                              <span
                                key={i}
                                className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400"
                              >
                                <Music className="h-3 w-3" />
                                {m}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reels Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {reels.length} Contenidos Encontrados
                </h3>
                <div className="flex items-center gap-1">
                  {(["ALL", "REEL", "POST", "CAROUSEL"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setContentFilter(type)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        contentFilter === type
                          ? "bg-orange-600 text-white"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type === "ALL" ? "Todos" : type === "REEL" ? "Reels" : type === "POST" ? "Posts" : "Carousels"}
                      {type !== "ALL" && (
                        <span className="ml-1 opacity-70">
                          ({reels.filter((r) => r.contentType === type).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reels.filter((r) => contentFilter === "ALL" || r.contentType === contentFilter).map((reel, index) => (
                  <div
                    key={reel.id}
                    className="group rounded-xl border bg-card transition-all hover:border-orange-500/30"
                  >
                    {/* Inline Instagram Embed */}
                    <div className="relative rounded-t-xl overflow-hidden">
                      <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          reel.contentType === "REEL"
                            ? "bg-purple-600/80 text-white"
                            : reel.contentType === "CAROUSEL"
                              ? "bg-blue-600/80 text-white"
                              : "bg-green-600/80 text-white"
                        }`}>
                          {reel.contentType === "REEL" ? "Reel" : reel.contentType === "CAROUSEL" ? "Carousel" : "Post"}
                        </span>
                      </div>
                      <div className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-xs text-green-400">
                        {getEngagementRate(reel).toFixed(1)}% ER
                      </div>
                      <InstagramEmbed url={reel.instagramUrl} />
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      {/* Username — clickable to Instagram */}
                      <div className="mb-2 flex items-center justify-between">
                        <a
                          href={reel.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-orange-400 hover:underline"
                        >
                          @{reel.ownerUsername || "unknown"}
                        </a>
                        <a
                          href={reel.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-full bg-pink-600/20 px-2 py-0.5 text-xs text-pink-400 transition-colors hover:bg-pink-600/30"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver en IG
                        </a>
                      </div>

                      {/* Caption preview */}
                      {reel.caption && (
                        <p className="mb-3 line-clamp-3 text-xs text-muted-foreground">
                          {reel.caption}
                        </p>
                      )}

                      {/* Metrics */}
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        <div className="text-center">
                          <Eye className="mx-auto mb-0.5 h-3 w-3 text-muted-foreground" />
                          <p className="text-xs font-semibold">
                            {formatNumber(reel.viewsCount)}
                          </p>
                        </div>
                        <div className="text-center">
                          <Heart className="mx-auto mb-0.5 h-3 w-3 text-red-400" />
                          <p className="text-xs font-semibold">
                            {formatNumber(reel.likesCount)}
                          </p>
                        </div>
                        <div className="text-center">
                          <MessageCircle className="mx-auto mb-0.5 h-3 w-3 text-blue-400" />
                          <p className="text-xs font-semibold">
                            {formatNumber(reel.commentsCount)}
                          </p>
                        </div>
                        <div className="text-center">
                          <Share2 className="mx-auto mb-0.5 h-3 w-3 text-green-400" />
                          <p className="text-xs font-semibold">
                            {formatNumber(reel.sharesCount)}
                          </p>
                        </div>
                      </div>

                      {/* Music & Duration */}
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {reel.musicName && (
                          <span className="flex items-center gap-1">
                            <Music className="h-3 w-3" />
                            {reel.musicName.substring(0, 30)}
                          </span>
                        )}
                        {reel.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {reel.duration.toFixed(0)}s
                          </span>
                        )}
                      </div>

                      {/* Remix Button */}
                      <button
                        onClick={() => remixReel(reel.id)}
                        disabled={remixLoading === reel.id}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-orange-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {remixLoading === reel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {remixLoading === reel.id
                          ? "Generando remix..."
                          : reel.aiAnalysis
                            ? "Re-remix"
                            : "Remix para mi marca"}
                      </button>

                      {/* Show existing remix if available */}
                      {reel.aiAnalysis && activeRemix?.reelId !== reel.id && (
                        <button
                          onClick={() =>
                            setActiveRemix({ reelId: reel.id, data: reel.aiAnalysis })
                          }
                          className="mt-2 w-full text-center text-xs text-purple-400 hover:underline"
                        >
                          Ver remix anterior
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remix Detail Modal */}
          {activeRemix && (
            <div className="rounded-xl border border-purple-500/30 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-semibold">
                    Remix: {activeRemix.data.remix_concept?.title || "Content Idea"}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveRemix(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Why it worked + Concept */}
                <div className="space-y-4">
                  {/* Viral Analysis */}
                  {activeRemix.data.viral_analysis && (
                    <div className="rounded-lg bg-green-500/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-green-400">
                        Por que se hizo viral
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {activeRemix.data.viral_analysis.why_it_worked}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          Hook: {activeRemix.data.viral_analysis.hook_type}
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          Emocion: {activeRemix.data.viral_analysis.emotional_trigger}
                        </span>
                        {activeRemix.data.viral_analysis.engagement_score && (
                          <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
                            Score: {activeRemix.data.viral_analysis.engagement_score}/10
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Remix Concept */}
                  {activeRemix.data.remix_concept && (
                    <div className="rounded-lg bg-purple-500/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-purple-400">
                        Concepto del Remix
                      </h4>
                      <div className="mb-2 flex gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                          {activeRemix.data.remix_concept.format}
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          {activeRemix.data.remix_concept.duration_seconds}s
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {activeRemix.data.remix_concept.description}
                      </p>

                      {/* Scenes */}
                      {activeRemix.data.remix_concept.scenes?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            STORYBOARD:
                          </p>
                          {activeRemix.data.remix_concept.scenes.map(
                            (scene: any, i: number) => (
                              <div
                                key={i}
                                className="rounded bg-muted/30 p-2 text-xs"
                              >
                                <span className="font-mono font-bold text-purple-400">
                                  {scene.time}
                                </span>
                                <span className="ml-2">{scene.visual}</span>
                                {scene.text_overlay && (
                                  <p className="mt-0.5 italic text-muted-foreground">
                                    Texto: &quot;{scene.text_overlay}&quot;
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Copy + Production */}
                <div className="space-y-4">
                  {/* Copy */}
                  {activeRemix.data.copy && (
                    <div className="rounded-lg bg-blue-500/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-blue-400">
                        Copy Sugerido
                      </h4>
                      {activeRemix.data.copy.hook_opening && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground">HOOK:</p>
                          <p className="text-sm font-medium">
                            &quot;{activeRemix.data.copy.hook_opening}&quot;
                          </p>
                        </div>
                      )}
                      {activeRemix.data.copy.caption && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground">CAPTION:</p>
                          <p className="whitespace-pre-wrap text-sm">
                            {activeRemix.data.copy.caption}
                          </p>
                        </div>
                      )}
                      {activeRemix.data.copy.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {activeRemix.data.copy.hashtags.map(
                            (h: string, i: number) => (
                              <span
                                key={i}
                                className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
                              >
                                #{h.replace("#", "")}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Production Tips */}
                  {activeRemix.data.production_tips && (
                    <div className="rounded-lg bg-yellow-500/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-yellow-400">
                        Tips de Produccion
                      </h4>
                      {activeRemix.data.production_tips.music_suggestion && (
                        <p className="mb-2 flex items-center gap-1 text-sm">
                          <Music className="h-3 w-3 text-purple-400" />
                          {activeRemix.data.production_tips.music_suggestion}
                        </p>
                      )}
                      {activeRemix.data.production_tips.filming_tips?.map(
                        (tip: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            - {tip}
                          </p>
                        )
                      )}
                      {activeRemix.data.production_tips.editing_style && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Edicion: {activeRemix.data.production_tips.editing_style}
                        </p>
                      )}
                      {activeRemix.data.production_tips.best_posting_time && (
                        <p className="mt-1 text-xs text-orange-400">
                          Mejor horario: {activeRemix.data.production_tips.best_posting_time}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Variations */}
                  {activeRemix.data.variations?.length > 0 && (
                    <div className="rounded-lg bg-muted/30 p-4">
                      <h4 className="mb-2 text-sm font-semibold">
                        Variaciones A/B
                      </h4>
                      {activeRemix.data.variations.map(
                        (v: any, i: number) => (
                          <div key={i} className="mb-1">
                            <span className="text-xs font-medium text-orange-400">
                              {v.name}:
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">
                              {v.twist}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
