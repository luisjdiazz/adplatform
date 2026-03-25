"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, X, FileVideo, FileImage, Loader2,
  GripVertical, Layers, Image as ImageIcon, Film, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BulkUploaderProps {
  clientId: string;
  batchId: string;
  onUploadComplete: (posts: any[]) => void;
}

type PostType = "SINGLE" | "REEL" | "CAROUSEL";

interface UploadItem {
  id: string;
  file: File;
  postType: PostType;
  carouselGroupId: string | null;
  carouselOrder: number;
  userContext: string;
  previewUrl: string;
}

interface CarouselGroup {
  id: string;
  items: UploadItem[];
  userContext: string;
  collapsed: boolean;
}

let nextId = 0;
function genId() {
  return `upload-${Date.now()}-${nextId++}`;
}

function genGroupId() {
  return `carousel-${Date.now()}-${nextId++}`;
}

export function BulkUploader({ clientId, batchId, onUploadComplete }: BulkUploaderProps) {
  const [singles, setSingles] = useState<UploadItem[]>([]);
  const [carousels, setCarousels] = useState<CarouselGroup[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
  ];

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => acceptedTypes.includes(f.type));
    const items: UploadItem[] = files.map((f) => ({
      id: genId(),
      file: f,
      postType: f.type.startsWith("video") ? "REEL" as PostType : "SINGLE" as PostType,
      carouselGroupId: null,
      carouselOrder: 0,
      userContext: "",
      previewUrl: URL.createObjectURL(f),
    }));
    setSingles((prev) => [...prev, ...items]);
  }

  function removeSingle(id: string) {
    setSingles((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateSingleContext(id: string, context: string) {
    setSingles((prev) => prev.map((i) => (i.id === id ? { ...i, userContext: context } : i)));
  }

  function updateSingleType(id: string, postType: PostType) {
    setSingles((prev) => prev.map((i) => (i.id === id ? { ...i, postType } : i)));
  }

  // Create carousel from selected singles
  function createCarouselFromSelected(ids: string[]) {
    if (ids.length < 2) return;
    const groupId = genGroupId();
    const selected = singles.filter((s) => ids.includes(s.id));
    const items = selected.map((s, i) => ({
      ...s,
      postType: "CAROUSEL" as PostType,
      carouselGroupId: groupId,
      carouselOrder: i,
    }));
    setCarousels((prev) => [...prev, { id: groupId, items, userContext: "", collapsed: false }]);
    setSingles((prev) => prev.filter((s) => !ids.includes(s.id)));
  }

  // Break carousel back to singles
  function breakCarousel(groupId: string) {
    const group = carousels.find((c) => c.id === groupId);
    if (!group) return;
    const items = group.items.map((i) => ({
      ...i,
      postType: "SINGLE" as PostType,
      carouselGroupId: null,
      carouselOrder: 0,
    }));
    setSingles((prev) => [...prev, ...items]);
    setCarousels((prev) => prev.filter((c) => c.id !== groupId));
  }

  function removeFromCarousel(groupId: string, itemId: string) {
    setCarousels((prev) =>
      prev.map((c) => {
        if (c.id !== groupId) return c;
        const item = c.items.find((i) => i.id === itemId);
        if (item) {
          // Move back to singles
          setSingles((s) => [...s, { ...item, postType: "SINGLE", carouselGroupId: null, carouselOrder: 0 }]);
        }
        const newItems = c.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, carouselOrder: idx }));
        return { ...c, items: newItems };
      }).filter((c) => c.items.length > 0)
    );
  }

  function moveInCarousel(groupId: string, itemId: string, direction: "up" | "down") {
    setCarousels((prev) =>
      prev.map((c) => {
        if (c.id !== groupId) return c;
        const idx = c.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return c;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= c.items.length) return c;
        const items = [...c.items];
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        return { ...c, items: items.map((i, order) => ({ ...i, carouselOrder: order })) };
      })
    );
  }

  function updateCarouselContext(groupId: string, context: string) {
    setCarousels((prev) => prev.map((c) => (c.id === groupId ? { ...c, userContext: context } : c)));
  }

  function toggleCarouselCollapse(groupId: string) {
    setCarousels((prev) => prev.map((c) => (c.id === groupId ? { ...c, collapsed: !c.collapsed } : c)));
  }

  // Selection for creating carousels
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalItems = singles.length + carousels.reduce((sum, c) => sum + c.items.length, 0);
  const totalPosts = singles.length + carousels.length;

  async function handleUpload() {
    if (totalItems === 0) return;
    setUploading(true);

    try {
      const allCreatedPosts: any[] = [];

      // Upload singles/reels
      for (let i = 0; i < singles.length; i++) {
        const item = singles[i];
        setUploadProgress(`Subiendo ${i + 1}/${totalItems}...`);
        const formData = new FormData();
        formData.append("clientId", clientId);
        formData.append("batchId", batchId);
        formData.append("files", item.file);
        formData.append("postType", item.postType);
        if (item.userContext) formData.append("userContext", item.userContext);

        const res = await fetch("/api/content-scheduler/posts", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.posts) allCreatedPosts.push(...data.posts);
      }

      // Upload carousels
      let uploadedCount = singles.length;
      for (const carousel of carousels) {
        const groupId = genGroupId(); // new ID for DB
        for (let i = 0; i < carousel.items.length; i++) {
          const item = carousel.items[i];
          uploadedCount++;
          setUploadProgress(`Subiendo ${uploadedCount}/${totalItems}...`);

          const formData = new FormData();
          formData.append("clientId", clientId);
          formData.append("batchId", batchId);
          formData.append("files", item.file);
          formData.append("postType", "CAROUSEL");
          formData.append("carouselGroupId", groupId);
          formData.append("carouselOrder", String(i));
          if (carousel.userContext) formData.append("userContext", carousel.userContext);

          const res = await fetch("/api/content-scheduler/posts", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.posts) allCreatedPosts.push(...data.posts);
        }
      }

      onUploadComplete(allCreatedPosts);
      // Cleanup
      singles.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      carousels.forEach((c) => c.items.forEach((i) => URL.revokeObjectURL(i.previewUrl)));
      setSingles([]);
      setCarousels([]);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const imageOnlySingles = singles.filter((s) => !s.file.type.startsWith("video"));
  const canCreateCarousel = selectedIds.size >= 2 && [...selectedIds].every((id) => imageOnlySingles.some((s) => s.id === id));

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Arrastra tus archivos aqui o haz click para seleccionar</p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP, MP4, MOV, WebM — selecciona multiples archivos
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); if (e.target) e.target.value = ""; }}
        />
      </div>

      {/* Create carousel button */}
      {selectedIds.size >= 2 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm">{selectedIds.size} imagenes seleccionadas</span>
          <Button
            size="sm"
            onClick={() => {
              createCarouselFromSelected([...selectedIds]);
              setSelectedIds(new Set());
            }}
            disabled={!canCreateCarousel}
          >
            <Layers className="mr-1 h-3 w-3" />
            Crear carrusel
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Singles / Reels */}
      {singles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {singles.length} archivo{singles.length !== 1 ? "s" : ""} individual{singles.length !== 1 ? "es" : ""}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { singles.forEach((s) => URL.revokeObjectURL(s.previewUrl)); setSingles([]); setSelectedIds(new Set()); }}>
                Limpiar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Haz click en las imagenes para seleccionar y crear un carrusel</p>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {singles.map((item) => {
              const isVideo = item.file.type.startsWith("video");
              const isSelected = selectedIds.has(item.id);
              return (
                <div key={item.id} className="space-y-1">
                  <div
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => !isVideo && toggleSelect(item.id)}
                  >
                    {isVideo ? (
                      <video src={item.previewUrl} className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    {/* Type badge */}
                    <div className="absolute top-1 left-1">
                      {isVideo ? (
                        <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Reel</Badge>
                      ) : (
                        <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Imagen</Badge>
                      )}
                    </div>
                    {/* Selection check */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    )}
                    {/* Remove */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSingle(item.id); selectedIds.delete(item.id); }}
                      className="absolute bottom-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {/* Size */}
                    <div className="absolute bottom-1 left-1">
                      <span className="bg-black/60 text-white text-[9px] px-1 rounded">{formatSize(item.file.size)}</span>
                    </div>
                  </div>
                  {/* Context input */}
                  <input
                    type="text"
                    placeholder="Contexto (opcional)"
                    value={item.userContext}
                    onChange={(e) => updateSingleContext(item.id, e.target.value)}
                    className="w-full text-[11px] px-2 py-1 rounded border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Carousels */}
      {carousels.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {carousels.length} carrusel{carousels.length !== 1 ? "es" : ""}
          </p>
          {carousels.map((carousel) => (
            <div key={carousel.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer"
                onClick={() => toggleCarouselCollapse(carousel.id)}
              >
                <Layers className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium flex-1">
                  Carrusel — {carousel.items.length} slides
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); breakCarousel(carousel.id); }}
                >
                  Desagrupar
                </Button>
                {carousel.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>

              {!carousel.collapsed && (
                <div className="p-3 space-y-3">
                  {/* Carousel context */}
                  <textarea
                    placeholder="Contexto del carrusel: tema, objetivo, que quieres comunicar..."
                    value={carousel.userContext}
                    onChange={(e) => updateCarouselContext(carousel.id, e.target.value)}
                    rows={2}
                    className="w-full text-xs px-3 py-2 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />

                  {/* Slides */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {carousel.items.map((item, idx) => (
                      <div key={item.id} className="relative shrink-0 w-24">
                        <div className="relative aspect-square rounded-lg overflow-hidden border">
                          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                          {/* Order badge */}
                          <div className="absolute top-1 left-1">
                            <span className="bg-purple-500 text-white text-[10px] px-1.5 rounded font-bold">
                              {idx + 1}
                            </span>
                          </div>
                          {/* Controls */}
                          <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                            <button
                              onClick={() => removeFromCarousel(carousel.id, item.id)}
                              className="bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {/* Reorder buttons */}
                          <div className="absolute bottom-1 inset-x-1 flex justify-center gap-1">
                            {idx > 0 && (
                              <button
                                onClick={() => moveInCarousel(carousel.id, item.id, "up")}
                                className="bg-black/60 text-white rounded p-0.5 hover:bg-primary"
                              >
                                <ChevronUp className="h-3 w-3 -rotate-90" />
                              </button>
                            )}
                            {idx < carousel.items.length - 1 && (
                              <button
                                onClick={() => moveInCarousel(carousel.id, item.id, "down")}
                                className="bg-black/60 text-white rounded p-0.5 hover:bg-primary"
                              >
                                <ChevronDown className="h-3 w-3 -rotate-90" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Add more to carousel button */}
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="shrink-0 w-24 aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-[10px] mt-1">Agregar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
          <div className="text-sm">
            <span className="font-medium">{totalPosts} post{totalPosts !== 1 ? "s" : ""}</span>
            <span className="text-muted-foreground ml-1">
              ({singles.filter((s) => s.postType === "SINGLE").length} imagenes,{" "}
              {singles.filter((s) => s.postType === "REEL").length} reels,{" "}
              {carousels.length} carrusel{carousels.length !== 1 ? "es" : ""})
            </span>
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadProgress}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Subir {totalItems} archivo{totalItems !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
