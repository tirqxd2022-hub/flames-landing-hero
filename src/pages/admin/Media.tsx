import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Pencil, RefreshCw, Replace, Search, Sparkles, Tag, Trash2, Upload, X } from "lucide-react";
import { adminApi, resolveAssetUrl, type ImageItem, type ImageFolder, type ImageUsage, type VideoItem } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { HoverThumb } from "@/components/ui/hover-thumb";

type MediaTab = ImageFolder | "videos";


type CropBox = { x: number; y: number; width: number; height: number };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function promptRename(filename: string, folder: ImageFolder): Promise<string | null> {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  const input = window.prompt(`Rename image (extension ${ext || "none"} preserved):`, base);
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed === base) return null;
  try { const r = await adminApi.renameImage(filename, trimmed, folder); toast.success("Image renamed"); return r.filename; }
  catch (e) { toast.error(e instanceof Error ? e.message : "Rename failed"); return null; }
}

export default function AdminMedia() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [tab, setTab] = useState<MediaTab>("page");
  const isVideoTab = tab === "videos";
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [imgs, vids] = await Promise.all([
        adminApi.listImages(),
        adminApi.listVideos().catch(() => ({ items: [] as VideoItem[] })),
      ]);
      setItems(imgs.items);
      setVideos(vids.items);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load media"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const tabItems = useMemo(() => isVideoTab ? [] : items.filter((i) => (i.folder || "page") === tab), [items, tab, isVideoTab]);
  const pending = tabItems.filter((i) => !i.optimized).length;
  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => v.filename.toLowerCase().includes(q));
  }, [videos, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabItems;
    return tabItems.filter((i) => i.filename.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  }, [tabItems, query]);
  const visibleCount = isVideoTab ? filteredVideos.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(visibleCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filtered, currentPage, pageSize]);
  const pagedVideos = useMemo(() => filteredVideos.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredVideos, currentPage, pageSize]);
  useEffect(() => { setPage(1); }, [query, pageSize, tab]);

  async function optimizeAll() {
    if (isVideoTab) return;
    setBulkBusy(true);
    try {
      const r = await adminApi.optimizeAllImages(tab as ImageFolder);
      toast.success(`Optimized ${r.optimized} of ${r.total} pending image(s)${r.failed ? `, ${r.failed} failed` : ""}.`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bulk optimize failed"); }
    finally { setBulkBusy(false); }
  }
  async function scanDuplicates() {
    if (isVideoTab) return;
    setScanBusy(true);
    try {
      const r = await adminApi.scanDuplicateImages(tab as ImageFolder);
      toast.success(r.removed ? `Deleted ${r.removed} duplicate image(s).` : "No exact duplicates found.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Duplicate scan failed"); }
    finally { setScanBusy(false); }
  }
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    for (const f of files) {
      try {
        if (isVideoTab) await adminApi.uploadVideo(f);
        else await adminApi.upload(f, tab as ImageFolder);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    }
    await load();
  }

  function triggerReplace(filename: string) {
    replaceTargetRef.current = filename;
    replaceInputRef.current?.click();
  }
  async function onReplaceFile(file: File) {
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!target) return;
    try {
      await adminApi.replaceVideo(target, file);
      toast.success("Video replaced");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Replace failed"); }
  }
  async function deleteVideo(filename: string) {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    try {
      await adminApi.deleteVideo(filename);
      toast.success("Video deleted");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Media</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage uploaded images and videos and keep website references in sync.</p>
      <section className="mt-6 rounded-2xl border border-white/5 bg-[color:var(--card)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Gallery</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isVideoTab
                ? `${videos.length} video file(s).`
                : `${pending} pending optimization of ${tabItems.length} total image(s) in this folder.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[color:var(--flame)] px-3 py-1.5 text-xs font-semibold text-white">
              <Upload className="h-3.5 w-3.5" /> Upload
              <input type="file" multiple accept={isVideoTab ? "video/mp4,video/webm,.mp4,.webm" : "image/*"} className="hidden"
                onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.currentTarget.value = ""; }} />
            </label>
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {!isVideoTab && (
              <>
                <button onClick={optimizeAll} disabled={bulkBusy || pending === 0} className="inline-flex items-center gap-2 rounded-md bg-[color:var(--gold)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" /> {bulkBusy ? "Optimizing…" : `Optimize All (${pending})`}
                </button>
                <button onClick={scanDuplicates} disabled={scanBusy || tabItems.length < 2} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50">
                  <Search className="h-3.5 w-3.5" /> {scanBusy ? "Scanning…" : "Scan for Duplicate"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2 border-b border-white/10">
          {(["page", "products", "videos"] as MediaTab[]).map((f) => {
            const count = f === "videos" ? videos.length : items.filter((i) => (i.folder || "page") === f).length;
            const active = tab === f;
            const label = f === "page" ? "Page Images" : f === "products" ? "Food Images" : "Videos";
            return (
              <button key={f} onClick={() => setTab(f)}
                className={`-mb-px inline-flex items-center gap-1 border-b-2 px-3 py-2 text-sm ${active ? "border-[color:var(--flame)] text-white font-semibold" : "border-transparent text-muted-foreground hover:text-white"}`}>
                {f === "videos" && <Film className="h-3.5 w-3.5" />} {label} <span className="text-xs text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
        <input ref={replaceInputRef} type="file" accept="video/mp4,video/webm,.mp4,.webm" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceFile(f); e.currentTarget.value = ""; }} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isVideoTab ? "Search videos…" : "Search images…"} className="h-10 w-full rounded-md border border-white/10 bg-background pl-9 pr-3 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Show
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-9 rounded-md border border-white/10 bg-background px-2 text-sm">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            per page
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
            : isVideoTab ? (
              filteredVideos.length === 0 ? <div className="text-sm text-muted-foreground">No videos uploaded. Upload .mp4 or .webm files.</div> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-white/10"><th className="py-2 pr-2">Preview</th><th className="py-2 pr-2">Filename</th><th className="py-2 pr-2">Size</th><th className="py-2 pr-2">Format</th><th className="py-2 pr-2 text-right">Action</th></tr></thead>
                  <tbody>{pagedVideos.map((v) => (
                    <tr key={v.filename} className="border-b border-white/5">
                      <td className="py-2 pr-2">
                        <div className="h-12 w-20 overflow-hidden rounded border border-white/10 bg-black">
                          <video key={v.mtime} src={`${resolveAssetUrl(v.url)}?v=${v.mtime}`} className="h-full w-full object-cover" muted preload="metadata" />
                        </div>
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs break-all">{v.filename}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{formatBytes(v.size)}</td>
                      <td className="py-2 pr-2"><span className="inline-flex rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground">{v.ext}</span></td>
                      <td className="py-2 pr-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => triggerReplace(v.filename)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"><Replace className="h-3 w-3" /> Replace</button>
                          <button onClick={() => navigator.clipboard.writeText(v.url).then(() => toast.success("Video link copied")).catch(() => {})} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Copy</button>
                          <button onClick={() => deleteVideo(v.filename)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              )
            ) : filtered.length === 0 ? <div className="text-sm text-muted-foreground">No images found.</div> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-white/10"><th className="py-2 pr-2">Preview</th><th className="py-2 pr-2">Filename</th><th className="py-2 pr-2">Size</th><th className="py-2 pr-2">Optimized</th><th className="py-2 pr-2">Used</th><th className="py-2 pr-2 text-right">Action</th></tr></thead>
              <tbody>{paged.map((it) => (
                <tr key={`${it.folder}/${it.filename}`} className="border-b border-white/5">
                  <td className="py-2 pr-2"><HoverThumb src={it.url} alt={it.filename} className="h-10 w-14 rounded object-cover border border-white/10 bg-background" /></td>
                  <td className="py-2 pr-2 font-mono text-xs">{it.filename}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{formatBytes(it.size)}</td>
                  <td className="py-2 pr-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${it.optimized ? "bg-[color:var(--flame)]/15 text-[color:var(--flame-light)]" : "bg-white/5 text-muted-foreground"}`}>{it.optimized ? "Yes" : "No"}</span></td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{it.usedCount}</td>
                  <td className="py-2 pr-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={async () => { const r = await promptRename(it.filename, it.folder || "page"); if (r) await load(); }} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"><Tag className="h-3 w-3" /> Rename</button>
                      <button onClick={() => setSelected(it)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"><Pencil className="h-3 w-3" /> Edit</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        {!loading && visibleCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleCount)} of {visibleCount}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/5 disabled:opacity-40">Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>
      {selected && <ImageEditModal item={selected} onClose={() => setSelected(null)} onChanged={async () => { setSelected(null); await load(); }} />}
    </div>
  );
}

function ImageEditModal({ item, onClose, onChanged }: { item: ImageItem; onClose: () => void; onChanged: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizeWidth, setResizeWidth] = useState("");
  const [busy, setBusy] = useState(false);
  const [alt, setAltText] = useState(item.alt || "");
  const [savingAlt, setSavingAlt] = useState(false);
  const [usages, setUsages] = useState<ImageUsage[]>(item.usages || []);
  const inUse = usages.length > 0;
  const folder: ImageFolder = item.folder || "page";

  useEffect(() => {
    let cancelled = false;
    adminApi.imageUsage(item.filename, folder)
      .then((r) => { if (!cancelled) setUsages(r.usages || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item.filename, folder]);

  function point(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)) };
  }
  function pointerDown(e: React.PointerEvent<HTMLDivElement>) { const p = point(e); setDragStart({ x: p.x, y: p.y }); setCrop({ x: p.x, y: p.y, width: 1, height: 1 }); }
  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const p = point(e);
    setCrop({ x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y), width: Math.abs(p.x - dragStart.x), height: Math.abs(p.y - dragStart.y) });
  }

  async function saveAlt() { setSavingAlt(true); try { await adminApi.setImageAlt(item.filename, alt, folder); toast.success("Alt text saved"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save alt text"); } finally { setSavingAlt(false); } }
  async function optimize() { setBusy(true); try { await adminApi.optimizeImage(item.filename, folder); toast.success("Image optimized"); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Optimize failed"); } finally { setBusy(false); } }
  async function applyEdit() {
    const img = imgRef.current; if (!img) return;
    const rect = img.getBoundingClientRect();
    const scaledCrop = crop && crop.width > 4 && crop.height > 4 ? { x: Math.round(crop.x * natural.width / rect.width), y: Math.round(crop.y * natural.height / rect.height), width: Math.round(crop.width * natural.width / rect.width), height: Math.round(crop.height * natural.height / rect.height) } : null;
    const width = resizeWidth ? Number(resizeWidth) : undefined;
    if (!scaledCrop && !width) { toast.error("Choose a crop area or resize width first."); return; }
    setBusy(true);
    try {
      if (alt.trim() && alt !== item.alt) await adminApi.setImageAlt(item.filename, alt, folder);
      await adminApi.editImage({ filename: item.filename, folder, crop: scaledCrop, width });
      toast.success("Image updated"); onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Edit failed"); }
    finally { setBusy(false); }
  }
  async function replace(file: File) { setBusy(true); try { const up = await adminApi.upload(file, folder); await adminApi.replaceImage(item.filename, up.url, folder); toast.success("Image replaced"); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Replace failed"); } finally { setBusy(false); } }
  async function copyLink() { await navigator.clipboard.writeText(item.url); toast.success("Image link copied"); }
  async function remove() {
    if (inUse) return;
    if (!confirm("Delete this image? This cannot be undone.")) return;
    setBusy(true);
    try { await adminApi.deleteImage(item.filename, folder); toast.success("Image deleted"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[color:var(--card)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Edit image</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="break-all font-mono text-xs text-muted-foreground">{item.filename}</p>
              <button type="button" onClick={async () => { const r = await promptRename(item.filename, folder); if (r) onChanged(); }}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-xs hover:bg-white/5"><Tag className="h-3 w-3" /> Rename</button>
            </div>
            <div className="mt-2 text-xs">
              <span className="font-medium text-muted-foreground">Used on: </span>
              {usages.length === 0 ? <span className="text-muted-foreground italic">Not in use</span> : (
                <span className="inline-flex flex-wrap gap-1.5">
                  {usages.map((u, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs">
                      {u.label}{u.page ? <span className="text-muted-foreground">({u.page})</span> : null}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 p-2 hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
          <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => setDragStart(null)} className="relative overflow-hidden rounded-lg border border-white/10 bg-background touch-none">
            <img ref={imgRef} src={resolveAssetUrl(item.url)} alt={alt || item.filename} onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} className="max-h-[58vh] w-full object-contain select-none" draggable={false} />
            {crop && <div className="absolute border-2 border-[color:var(--flame)] bg-[color:var(--flame)]/15" style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }} />}
          </div>
          <div className="space-y-3">
            <button onClick={optimize} disabled={busy || item.optimized} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--gold)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"><Sparkles className="h-4 w-4" /> {item.optimized ? "Already optimized" : "Optimize"}</button>
            <div className="rounded-md border border-white/10 p-3">
              <label className="text-sm font-medium">Alt text</label>
              <p className="mt-1 text-xs text-muted-foreground">Used by search engines and screen readers.</p>
              <input value={alt} onChange={(e) => setAltText(e.target.value)} maxLength={500}
                className="mt-2 h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
              <button onClick={saveAlt} disabled={savingAlt} className="mt-2 w-full rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-50">{savingAlt ? "Saving…" : "Save alt text"}</button>
            </div>
            <div className="rounded-md border border-white/10 p-3">
              <label className="text-sm font-medium">Resize width (px)</label>
              <input value={resizeWidth} onChange={(e) => setResizeWidth(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 1200"
                className="mt-2 h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Drag on the image to crop. Apply to save edits as a new AVIF.</p>
              <button onClick={applyEdit} disabled={busy} className="mt-2 w-full rounded-md bg-[color:var(--flame)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Apply crop / resize"}</button>
            </div>
            <div className="rounded-md border border-white/10 p-3 space-y-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) replace(f); e.currentTarget.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-50">Replace with new file</button>
              <button onClick={copyLink} className="w-full rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Copy image link</button>
              <button onClick={remove} disabled={busy || inUse} title={inUse ? "Image is in use — cannot delete" : "Delete"} className="w-full rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40">Delete image</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
