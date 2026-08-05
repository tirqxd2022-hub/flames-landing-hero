import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { request, resolveAssetUrl } from "@/lib/api";
import { PAGE_IMAGE_SLOTS, refreshPageImageOverrides, type PageImageSlot } from "@/lib/page-images";

type Overrides = Record<string, string>;

export default function AdminPageImages() {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pages = useMemo(() => {
    const map = new Map<string, { label: string; slots: PageImageSlot[] }>();
    for (const slot of PAGE_IMAGE_SLOTS) {
      if (!map.has(slot.page)) map.set(slot.page, { label: slot.pageLabel, slots: [] });
      map.get(slot.page)!.slots.push(slot);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, []);

  const [activePage, setActivePage] = useState(pages[0]?.key || "home");

  useEffect(() => {
    let mounted = true;
    (async () => {
      let ov: Overrides = {};
      try { ov = (await request<Overrides>("/admin/page-images")) || {}; } catch { /* ignore */ }
      if (!mounted) return;
      setOverrides(ov);
      // Ask backend which file actually exists on disk for every slot URL
      // (so optimized .avif siblings show up instead of stale .jpg defaults).
      const urls = Array.from(new Set(PAGE_IMAGE_SLOTS.map((s) => ov[s.key] || s.defaultUrl)));
      try {
        const resolved = await request<Record<string, string>>("/admin/page-images/resolve", {
          method: "POST",
          body: JSON.stringify({ urls }),
        });
        if (mounted) setResolvedMap(resolved || {});
      } catch { /* keep originals */ }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function setOverride(slot: PageImageSlot, url: string) {
    setBusyKey(slot.key);
    try {
      await request(`/admin/page-images/${encodeURIComponent(slot.key)}`, {
        method: "PUT",
        body: JSON.stringify({ url }),
      });
      setOverrides((o) => ({ ...o, [slot.key]: url }));
      await refreshPageImageOverrides();
      toast.success(`${slot.label} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyKey(null);
    }
  }

  async function resetOverride(slot: PageImageSlot) {
    setBusyKey(slot.key);
    try {
      await request(`/admin/page-images/${encodeURIComponent(slot.key)}`, { method: "DELETE" });
      setOverrides((o) => { const n = { ...o }; delete n[slot.key]; return n; });
      await refreshPageImageOverrides();
      toast.success(`${slot.label} reset to default`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setBusyKey(null);
    }
  }

  const activeSlots = pages.find((p) => p.key === activePage)?.slots || [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Page Images</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Replace any image or video used on the storefront pages. Each slot is independent — the same default file
          appearing in two places will show up as two separate replaceable slots.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10">
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePage(p.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-md transition ${
              activePage === p.key
                ? "bg-[color:var(--card)] text-white border-b-2 border-[color:var(--flame)]"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeSlots.map((slot) => {
            const override = overrides[slot.key];
            const current = override || slot.defaultUrl;
            // Resolved = the file that actually exists on disk (e.g. .avif when
            // the .jpg default was optimized away). Falls back to the original.
            const liveUrl = resolvedMap[current] || current;
            const resolved = resolveAssetUrl(liveUrl);
            const ratio = slot.ratio || 16 / 9;
            return (
              <div key={slot.key} className="rounded-xl border border-white/10 bg-[color:var(--card)] p-4 flex flex-col gap-3">
                <div className="min-h-[2.5rem]">
                  <div className="font-semibold leading-tight">{slot.label}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1 break-all">{slot.key}</div>
                </div>
                <div
                  className="w-full overflow-hidden rounded-md bg-black/40 border border-white/10"
                  style={{ aspectRatio: String(ratio) }}
                >
                  {slot.kind === "video" ? (
                    <video src={resolved} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                  ) : (
                    <img src={resolved} alt={slot.label} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground break-all">{liveUrl}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <MediaPickerButton
                    onPick={(url) => setOverride(slot, url)}
                    hasValue={!!override}
                    addLabel="Replace"
                    replaceLabel="Replace"
                    disabled={busyKey === slot.key}
                    accept={slot.kind === "video" ? "video/*" : "image/*"}
                    uploadFolder="page"
                  />
                  {override && (
                    <button
                      type="button"
                      onClick={() => resetOverride(slot)}
                      disabled={busyKey === slot.key}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-50"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  )}
                  {override && (
                    <span className="text-[10px] uppercase tracking-wide text-[color:var(--flame-light)] font-semibold">Overridden</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
