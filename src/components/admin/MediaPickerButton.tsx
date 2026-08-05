import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Search, Upload as UploadIcon, Video as VideoIcon, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi, resolveAssetUrl, type ImageItem, type ImageFolder, type VideoItem } from "@/lib/api";

type Props = {
  onPick: (url: string) => void | Promise<void>;
  hasValue?: boolean;
  addLabel?: string;
  replaceLabel?: string;
  disabled?: boolean;
  className?: string;
  accept?: string;
  uploadFolder?: ImageFolder;
};

type MenuItem = { label: string; icon: React.ReactNode; onClick: () => void };

function PortalMenu({
  anchorRef, onClose, items,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  items: MenuItem[];
}) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 192;
      const menuH = 80;
      // open above if not enough space below
      const openUp = r.bottom + menuH > window.innerHeight;
      const top = openUp ? r.top - menuH - 4 : r.bottom + 4;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setPos({ left, top, width });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchorRef, onClose]);

  if (!pos) return null;
  return createPortal(
    <div ref={menuRef} data-admin-modal-portal="true"
      style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, pointerEvents: "auto", zIndex: 10000 }}
      className="overflow-hidden rounded-md border border-white/10 bg-[color:var(--card)] shadow-lg">
      {items.map((it, i) => (
        <button key={i} type="button" onClick={it.onClick}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${i > 0 ? "border-t border-white/10" : ""}`}>
          {it.icon} {it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function MediaPickerButton({
  onPick, hasValue, addLabel = "Add image", replaceLabel = "Replace image",
  disabled, className, accept = "image/*", uploadFolder = "page",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  async function handleFile(file: File) {
    setOpen(false);
    setBusy(true);
    try {
      const r = await adminApi.upload(file, uploadFolder);
      if (!r?.url) throw new Error("Upload returned no URL");
      await Promise.resolve();
      await onPick(r.url);
      toast.success("Image uploaded and set — click Save to apply");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button" disabled={disabled || busy} onClick={() => setOpen((v) => !v)}
        className={className ?? "inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"}
      >
        <ImageIcon className="h-4 w-4" />
        {busy ? "Uploading…" : hasValue ? replaceLabel : addLabel}
      </button>
      <input ref={fileRef} type="file" accept={accept} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = "";
          if (f) void handleFile(f);
        }} />
      {open && (
        <PortalMenu anchorRef={btnRef} onClose={() => setOpen(false)} items={[
          { label: "Select from Media", icon: <ImageIcon className="h-4 w-4" />, onClick: () => { setOpen(false); setPickerOpen(true); } },
          { label: "Upload File", icon: <UploadIcon className="h-4 w-4" />, onClick: () => { setOpen(false); fileRef.current?.click(); } },
        ]} />
      )}
      {pickerOpen && (
        <MediaLibraryModal initialTab={uploadFolder} onClose={() => setPickerOpen(false)}
          onSelect={async (url) => { setPickerOpen(false); await onPick(url); }} />
      )}
    </>
  );
}

export function VideoPickerButton({
  onPick, addLabel = "Add video", disabled, className,
}: {
  onPick: (url: string) => void | Promise<void>;
  addLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  async function handleFile(file: File) {
    setOpen(false);
    setBusy(true);
    try {
      const r = await adminApi.uploadVideo(file);
      if (!r?.url) throw new Error("Upload returned no URL");
      await Promise.resolve();
      await onPick(r.url);
      toast.success("Video uploaded — click Save to apply");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button" disabled={disabled || busy} onClick={() => setOpen((v) => !v)}
        className={className ?? "inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"}
      >
        <VideoIcon className="h-4 w-4" />
        {busy ? "Uploading…" : addLabel}
      </button>
      <input ref={fileRef} type="file" accept="video/mp4,video/webm" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = "";
          if (f) void handleFile(f);
        }} />
      {open && (
        <PortalMenu anchorRef={btnRef} onClose={() => setOpen(false)} items={[
          { label: "Select from Media", icon: <VideoIcon className="h-4 w-4" />, onClick: () => { setOpen(false); setPickerOpen(true); } },
          { label: "Upload Video", icon: <UploadIcon className="h-4 w-4" />, onClick: () => { setOpen(false); fileRef.current?.click(); } },
        ]} />
      )}
      {pickerOpen && (
        <VideoLibraryModal onClose={() => setPickerOpen(false)}
          onSelect={async (url) => { setPickerOpen(false); await onPick(url); }} />
      )}
    </>
  );
}

export function MediaLibraryModal({
  onClose, onSelect, initialTab = "page",
}: { onClose: () => void; onSelect: (url: string) => void; initialTab?: ImageFolder }) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ImageFolder>(initialTab);

  useEffect(() => {
    adminApi.listImages()
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load media"))
      .finally(() => setLoading(false));
  }, []);

  const tabItems = useMemo(() => items.filter((i) => (i.folder || "page") === tab), [items, tab]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabItems;
    return tabItems.filter((i) => i.filename.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  }, [tabItems, query]);

  return createPortal(
    <div data-admin-modal-portal="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }} onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[color:var(--card)] p-5 shadow-xl"
        style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Select from Media</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} image(s)</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 p-2 hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex gap-2 border-b border-white/10">
          {(["page", "products"] as ImageFolder[]).map((f) => {
            const count = items.filter((i) => (i.folder || "page") === f).length;
            const active = tab === f;
            return (
              <button key={f} onClick={() => setTab(f)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${active ? "border-[color:var(--flame)] text-white font-semibold" : "border-transparent text-muted-foreground hover:text-white"}`}>
                {f === "page" ? "Page Images" : "Food Images"} <span className="text-xs text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search images…"
            className="h-10 w-full rounded-md border border-white/10 bg-background pl-9 pr-9 text-sm" />
          <SearchClearButton show={!!query} onClear={() => setQuery("")} />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No images found.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((it) => (
                <button key={`${it.folder}/${it.filename}`} type="button"
                  onClick={() => onSelect(it.url)}
                  className="group flex flex-col overflow-hidden rounded-md border border-white/10 bg-background text-left transition hover:border-[color:var(--flame)]">
                  <div className="relative aspect-square w-full overflow-hidden">
                    <img src={resolveAssetUrl(it.url)} alt={it.filename} loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105" />
                  </div>
                  <div className="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">{it.filename}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function VideoLibraryModal({
  onClose, onSelect,
}: { onClose: () => void; onSelect: (url: string) => void }) {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminApi.listVideos()
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load videos"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.filename.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  }, [items, query]);

  return createPortal(
    <div data-admin-modal-portal="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }} onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[color:var(--card)] p-5 shadow-xl"
        style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Select Video</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} video(s)</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 p-2 hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos…"
            className="h-10 w-full rounded-md border border-white/10 bg-background pl-9 pr-9 text-sm" />
          <SearchClearButton show={!!query} onClear={() => setQuery("")} />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No videos found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((it) => (
                <button key={it.filename} type="button"
                  onClick={() => onSelect(it.url)}
                  className="group flex flex-col overflow-hidden rounded-md border border-white/10 bg-background text-left transition hover:border-[color:var(--flame)]">
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    <video src={resolveAssetUrl(it.url)} className="h-full w-full object-cover" muted preload="metadata" />
                  </div>
                  <div className="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">{it.filename}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
