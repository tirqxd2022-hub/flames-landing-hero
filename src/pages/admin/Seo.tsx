import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Edit2, RefreshCw, Search, Trash2, X } from "lucide-react";
import { adminApi, resolveAssetUrl, type SeoPageRow } from "@/lib/api";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";

type Tab = "pages" | "sitemap" | "robots" | "verify" | "search" | "cache" | "schema";

const TABS: Array<[Tab, string]> = [
  ["pages", "Pages"],
  ["sitemap", "Sitemap"],
  ["robots", "robots.txt"],
  ["verify", "Verification / Analytics"],
  ["search", "Search Console"],
  ["cache", "Cache Settings"],
  ["schema", "Schema"],
];

const KNOWN_PATHS = [
  "/", "/menu", "/shop", "/about", "/contact",
  "/cart", "/checkout",
  "/dashboard", "/orders", "/current-orders", "/create-order", "/profile",
];

export default function AdminSeo() {
  const [tab, setTab] = useState<Tab>("pages");
  const [scanning, setScanning] = useState(false);

  async function scanForChanges() {
    setScanning(true);
    try {
      const r = await adminApi.scanSeoPages(KNOWN_PATHS);
      if (r.added > 0) toast.success(`Added ${r.added} new page(s) from site scan`);
      else toast.success("Scan complete — no new pages");
      window.dispatchEvent(new Event("seo:reload"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" /> SEO Tools
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage on-page SEO, sitemap, robots.txt, search-console verification and analytics tags.
          </p>
        </div>
        <button
          onClick={scanForChanges}
          disabled={scanning}
          className="inline-flex items-center gap-2 rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan for Changes"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === k
                ? "border-b-2 border-[color:var(--flame)] text-white"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "pages" && <PagesTab />}
        {tab === "sitemap" && <SitemapTab />}
        {tab === "robots" && <RobotsTab />}
        {tab === "verify" && <VerifyTab />}
        {tab === "search" && <SearchConsoleTab />}
        {tab === "cache" && <CacheTab />}
        {tab === "schema" && <SchemaTab />}
      </div>
    </div>
  );
}

function pageLabel(p: string): string {
  if (p === "/") return "Home";
  const last = p.replace(/^\//, "").split("/").pop() || p;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function YesNoBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
      <Check className="h-3 w-3" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-400">
      <X className="h-3 w-3" /> No
    </span>
  );
}

function PagesTab() {
  const [items, setItems] = useState<SeoPageRow[]>([]);
  const [editing, setEditing] = useState<SeoPageRow | null>(null);

  function load() {
    adminApi.listSeoPages().then((r) => setItems(r.items)).catch(() => {});
  }

  useEffect(() => {
    adminApi.scanSeoPages(KNOWN_PATHS).then(load).catch(load);
    const onReload = () => load();
    window.addEventListener("seo:reload", onReload);
    return () => window.removeEventListener("seo:reload", onReload);
  }, []);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.path === "/") return -1;
        if (b.path === "/") return 1;
        return a.path.localeCompare(b.path);
      }),
    [items],
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[color:var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Page</th>
              <th className="px-5 py-3 text-left font-medium">Focus keyword</th>
              <th className="px-5 py-3 text-left font-medium">SEO title</th>
              <th className="px-5 py-3 text-left font-medium">SEO description</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="px-5 py-4">
                  <div className="font-semibold text-white">{pageLabel(p.path)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{p.path}</div>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground">{p.focus_keyword || "—"}</td>
                <td className="px-5 py-4"><YesNoBadge ok={!!p.title} /></td>
                <td className="px-5 py-4"><YesNoBadge ok={!!p.description} /></td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => setEditing(p)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-background px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                  >
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  No pages yet. Click "Scan for Changes".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPageModal
          page={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function EditPageModal({
  page, onClose, onSaved,
}: { page: SeoPageRow; onClose: () => void; onSaved: () => void }) {
  const [focusKeyword, setFocusKeyword] = useState(page.focus_keyword || "");
  const [title, setTitle] = useState(page.title || "");
  const [description, setDescription] = useState(page.description || "");
  const [ogImage, setOgImage] = useState(page.og_image || "");
  const [saving, setSaving] = useState(false);

  const titleLen = title.length;
  const descLen = description.length;

  async function save() {
    setSaving(true);
    try {
      await adminApi.saveSeoPage({
        path: page.path,
        title: title || null,
        description: description || null,
        focusKeyword: focusKeyword || null,
        ogImage: ogImage || null,
        jsonLd: page.json_ld || null,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="mt-12 w-full max-w-2xl rounded-xl border border-white/10 bg-[color:var(--card)] shadow-xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Edit SEO — {pageLabel(page.path)}</h2>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{page.path}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <Field label="Focus keyword">
            <input
              value={focusKeyword}
              onChange={(e) => setFocusKeyword(e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
            />
          </Field>

          <Field label="SEO title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
            />
            <div className={`mt-1 text-xs ${titleLen > 60 ? "text-rose-400" : "text-muted-foreground"}`}>
              {titleLen}/60 (recommended 30–60)
            </div>
          </Field>

          <Field label="SEO description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-background p-3 text-sm"
            />
            <div className={`mt-1 text-xs ${descLen > 160 ? "text-rose-400" : "text-muted-foreground"}`}>
              {descLen}/160 (recommended 120–160)
            </div>
          </Field>

          <Field label="Social share image (og:image)">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="/uploads/…"
                className="h-10 min-w-[260px] flex-1 rounded-md border border-white/10 bg-background px-3 text-sm"
              />
              <MediaPickerButton
                hasValue={!!ogImage}
                onPick={(url) => setOgImage(url)}
                addLabel="Add image"
                replaceLabel="Replace image"
              />
              {ogImage && (
                <button
                  onClick={() => setOgImage("")}
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-xs font-medium hover:bg-white/5"
                >
                  Clear
                </button>
              )}
            </div>
            {ogImage && (
              <div className="mt-3">
                <img
                  src={resolveAssetUrl(ogImage)}
                  alt="og preview"
                  className="h-32 w-auto rounded-md border border-white/10 object-cover"
                />
                <div className="mt-1 text-xs text-muted-foreground">Recommended 1200×630.</div>
              </div>
            )}
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-white/10 bg-background px-4 py-2 text-sm font-medium hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-white">{label}</label>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-[color:var(--card)] p-5">{children}</div>;
}

function FlameButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 ${rest.className || ""}`}
    >
      {children}
    </button>
  );
}

function SitemapTab() {
  const [xml, setXml] = useState("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  function load() { adminApi.getSitemap().then((r) => { setXml(r.xml); setCount(r.urls.length); }).catch(() => {}); }
  useEffect(() => { load(); }, []);
  async function generate() {
    setBusy(true);
    try {
      const r = await adminApi.generateSitemap();
      setXml(r.xml); setCount(r.urls);
      toast.success(r.written?.written
        ? `Generated and written to ${r.written.path}`
        : `Generated (${r.urls} URLs). Could not write file: ${r.written?.reason || "unknown"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Sitemap.xml ({count} URLs)</h3>
        <FlameButton onClick={generate} disabled={busy} className="px-3 py-2 text-xs">
          {busy ? "Generating…" : "Generate sitemap.xml"}
        </FlameButton>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Generate writes <code>sitemap.xml</code> into <code>public_html/</code> on the server (set <code>PUBLIC_HTML_DIR</code> to override).
      </p>
      <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-white/10 bg-background p-3 text-xs">{xml}</pre>
    </Card>
  );
}

function RobotsTab() {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    adminApi.getSeoSettings()
      .then((r) => setV(r.settings.robots_txt || "User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: /sitemap.xml"))
      .catch(() => {});
  }, []);
  async function save() {
    try { await adminApi.saveSeoSettings({ robots_txt: v }); toast.success("Saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function generate() {
    setBusy(true);
    try {
      const r = await adminApi.generateRobots();
      setV(r.txt);
      toast.success(r.written?.written
        ? `Generated and written to ${r.written.path}`
        : `Generated. Could not write file: ${r.written?.reason || "unknown"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">robots.txt</h3>
        <FlameButton onClick={generate} disabled={busy} className="px-3 py-2 text-xs">
          {busy ? "Generating…" : "Generate robots.txt"}
        </FlameButton>
      </div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={10}
        className="mt-3 w-full rounded-md border border-white/10 bg-background p-3 font-mono text-xs"
      />
      <FlameButton onClick={save} className="mt-3">Save</FlameButton>
    </Card>
  );
}

function VerifyTab() {
  const [s, setS] = useState<Record<string, string>>({});
  useEffect(() => { adminApi.getSeoSettings().then((r) => setS(r.settings)).catch(() => {}); }, []);
  async function save() {
    try { await adminApi.saveSeoSettings(s); toast.success("Saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  const fields: Array<[string, string]> = [
    ["google_site_verification", "Google site verification"],
    ["bing_site_verification", "Bing site verification"],
    ["ga4_id", "GA4 measurement ID"],
    ["gtm_id", "Google Tag Manager ID"],
    ["fb_pixel", "Facebook Pixel ID"],
    ["google_ads_id", "Google Ads ID"],
  ];
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, l]) => (
          <label key={k} className="block">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{l}</div>
            <input
              value={s[k] || ""}
              onChange={(e) => setS({ ...s, [k]: e.target.value })}
              className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm"
            />
          </label>
        ))}
      </div>
      <FlameButton onClick={save} className="mt-4">Save</FlameButton>
    </Card>
  );
}

function SearchConsoleTab() {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-white">Search Console</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your verification token under the <strong>Verification / Analytics</strong> tab. To wire OAuth-based
        GSC integration, set up a Google Cloud project and add <code>GSC_CLIENT_ID</code> + <code>GSC_CLIENT_SECRET</code>
        to the server <code>.env</code> — the API will then expose endpoints under <code>/api/admin/gsc/*</code>.
      </p>
    </Card>
  );
}

const CACHE_DEFAULTS: Record<string, string> = {
  cache_enabled: "1",
  cache_html_max_age: "300",
  cache_html_swr: "86400",
  cache_asset_max_age: "2592000",
  cache_image_max_age: "31536000",
};

function CacheTab() {
  const [s, setS] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    adminApi.getSeoSettings().then((r) => {
      const merged: Record<string, string> = { ...r.settings };
      for (const [k, v] of Object.entries(CACHE_DEFAULTS)) if (!merged[k]) merged[k] = v;
      setS(merged);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  function set(k: string, v: string) { setS((prev) => ({ ...prev, [k]: v })); }

  async function save() {
    setSaving(true);
    try { await adminApi.saveSeoSettings(s); toast.success("Cache settings saved — applied in real time"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function purgeAll() {
    if (!confirm("Purge ALL Cloudflare cache for this zone? Visitors will see slower responses until the cache warms up.")) return;
    setPurging(true);
    try {
      await adminApi.saveSeoSettings({
        cf_zone_id: s.cf_zone_id || "",
        cf_account_id: s.cf_account_id || "",
        cf_api_token: s.cf_api_token || "",
      });
      const r = await adminApi.purgeCloudflare();
      toast.success(r.scope === "all" ? "Cloudflare cache purged" : "Selected URLs purged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setPurging(false);
    }
  }

  if (!loaded) return <Card><div className="text-sm text-muted-foreground">Loading…</div></Card>;

  const cacheFields: Array<[string, string, string]> = [
    ["cache_html_max_age", "HTML max-age (seconds)", "How long browsers and Cloudflare cache HTML responses. Default 300 (5 min)."],
    ["cache_html_swr", "HTML stale-while-revalidate (seconds)", "Serve stale HTML while revalidating in the background. Default 86400 (1 day)."],
    ["cache_asset_max_age", "JS/CSS max-age (seconds)", "Hashed build assets. Default 2592000 (30 days)."],
    ["cache_image_max_age", "Image / font max-age (seconds)", "Long-lived static media. Default 31536000 (1 year)."],
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Cache control</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults match the storefront <code>.htaccess</code>. Changes save instantly and take effect on the next response.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-white">
            <input
              type="checkbox"
              checked={s.cache_enabled !== "0"}
              onChange={(e) => set("cache_enabled", e.target.checked ? "1" : "0")}
            />
            Caching enabled
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cacheFields.map(([k, label, hint]) => (
            <label key={k} className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
              <input
                type="number"
                min={0}
                value={s[k] || ""}
                onChange={(e) => set(k, e.target.value)}
                className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm"
              />
              <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <FlameButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save cache settings"}
          </FlameButton>
          <button
            onClick={() => setS((prev) => ({ ...prev, ...CACHE_DEFAULTS }))}
            className="rounded-md border border-white/10 bg-background px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Reset to defaults
          </button>
        </div>
      </Card>

      <Card>
        <div>
          <h3 className="text-sm font-semibold text-white">Cloudflare</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect your Cloudflare zone to purge the edge cache in one click whenever you publish content.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Zone ID</div>
            <input
              value={s.cf_zone_id || ""}
              onChange={(e) => set("cf_zone_id", e.target.value)}
              placeholder="835fbad0ce05c4a17056e2227daf8f11"
              className="h-9 w-full rounded-md border border-white/10 bg-background px-2 font-mono text-xs"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Account ID</div>
            <input
              value={s.cf_account_id || ""}
              onChange={(e) => set("cf_account_id", e.target.value)}
              placeholder="0e6756aaa9b6c30ce987153c5ff86860"
              className="h-9 w-full rounded-md border border-white/10 bg-background px-2 font-mono text-xs"
            />
          </label>
          <label className="block sm:col-span-2">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">API Token</div>
            <input
              type="password"
              value={s.cf_api_token || ""}
              onChange={(e) => set("cf_api_token", e.target.value)}
              placeholder="Cloudflare API token with Zone → Cache Purge permission"
              className="h-9 w-full rounded-md border border-white/10 bg-background px-2 font-mono text-xs"
              autoComplete="off"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Create at Cloudflare → My Profile → API Tokens. Required scope: <code>Zone.Cache Purge</code>.
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md border border-white/10 bg-background px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Cloudflare settings"}
          </button>
          <button
            onClick={purgeAll}
            disabled={purging || !s.cf_zone_id || !s.cf_api_token}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            <Trash2 className={`h-4 w-4 ${purging ? "animate-pulse" : ""}`} />
            {purging ? "Purging…" : "Purge Cloudflare cache"}
          </button>
        </div>
      </Card>
    </div>
  );
}

import { useSiteSettings } from "@/hooks/use-site-settings";

function siteUrl(s: Record<string, string>): string {
  const fromSettings = (s.site_url || s.public_site_url || "").replace(/\/$/, "");
  if (fromSettings) return fromSettings;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.host}`;
  return "";
}

function pruneEmpty<T>(obj: T): T {
  if (Array.isArray(obj)) {
    const arr = obj.map(pruneEmpty).filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));
    return arr as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const pv = pruneEmpty(v);
      if (pv === undefined || pv === "" || (Array.isArray(pv) && pv.length === 0)) continue;
      if (pv && typeof pv === "object" && !Array.isArray(pv) && Object.keys(pv).length === 0) continue;
      out[k] = pv;
    }
    return out as T;
  }
  return obj;
}

function buildOrgTemplate(s: Record<string, string>): string {
  const url = siteUrl(s);
  const sameAs = [s.social_instagram, s.social_facebook, s.social_pinterest, s.social_youtube].filter(Boolean);
  return JSON.stringify(pruneEmpty({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.business_name || "Flames Gourmet",
    url,
    logo: s.logo_url ? (s.logo_url.startsWith("http") ? s.logo_url : `${url}${s.logo_url}`) : "",
    email: s.contact_email || "",
    telephone: s.contact_phone || "",
    address: s.contact_address ? { "@type": "PostalAddress", streetAddress: s.contact_address, addressCountry: "CA" } : "",
    sameAs,
  }), null, 2);
}

function buildWebsiteTemplate(s: Record<string, string>): string {
  const url = siteUrl(s);
  return JSON.stringify(pruneEmpty({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.business_name || "Flames Gourmet",
    url,
    potentialAction: url ? {
      "@type": "SearchAction",
      target: `${url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    } : "",
  }), null, 2);
}

function buildLocalTemplate(s: Record<string, string>): string {
  const url = siteUrl(s);
  return JSON.stringify(pruneEmpty({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: s.business_name || "Flames Gourmet",
    url,
    image: s.logo_url ? (s.logo_url.startsWith("http") ? s.logo_url : `${url}${s.logo_url}`) : "",
    servesCuisine: "Indian",
    telephone: s.contact_phone || "",
    email: s.contact_email || "",
    address: { "@type": "PostalAddress", streetAddress: s.contact_address || "", addressCountry: "CA" },
    sameAs: [s.social_instagram, s.social_facebook, s.social_pinterest, s.social_youtube].filter(Boolean),
  }), null, 2);
}

function SchemaTab() {
  const site = useSiteSettings() as Record<string, string>;
  const [s, setS] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    adminApi.getSeoSettings()
      .then((r) => setS(r.settings))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const templates = useMemo(() => ({
    schema_organization: buildOrgTemplate(site),
    schema_website: buildWebsiteTemplate(site),
    schema_local_business: buildLocalTemplate(site),
  }), [site]);

  // Prefill any empty schema field with the generated template once both
  // SEO settings and site settings have loaded.
  useEffect(() => {
    if (!loaded) return;
    setS((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(templates) as Array<keyof typeof templates>) {
        if (!(next[k] || "").trim()) { next[k] = templates[k]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [loaded, templates]);

  async function save() {
    try {
      for (const k of ["schema_organization", "schema_website", "schema_local_business"]) {
        const v = (s[k] || "").trim();
        if (v) { try { JSON.parse(v); } catch { return toast.error(`Invalid JSON in ${k}`); } }
      }
      await adminApi.saveSeoSettings(s);
      toast.success("Saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  const blocks: Array<[keyof typeof templates, string]> = [
    ["schema_organization", "Organization"],
    ["schema_website", "WebSite (with SearchAction)"],
    ["schema_local_business", "Restaurant / LocalBusiness"],
  ];
  return (
    <div className="space-y-5 pb-24">
      <Card>
        <h3 className="text-sm font-semibold text-white">Structured data (JSON-LD)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Prefilled from your site contact details. Edit any field and click <strong>Save schema</strong> to apply.
          Page-level JSON-LD can be added per page in the <strong>Pages</strong> tab.
        </p>
      </Card>
      {blocks.map(([k, label]) => (
        <Card key={k}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-white">{label}</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setS({ ...s, [k]: templates[k] })}
                className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-xs font-medium hover:bg-white/5"
              >
                Reset to prefilled
              </button>
            </div>
          </div>
          <textarea
            value={s[k] || ""}
            onChange={(e) => setS({ ...s, [k]: e.target.value })}
            rows={12}
            placeholder={templates[k]}
            className="mt-3 w-full rounded-md border border-white/10 bg-background p-3 font-mono text-xs"
          />
        </Card>
      ))}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="rounded-lg border border-white/10 bg-[color:var(--card)]/95 backdrop-blur px-3 py-2 shadow-xl shadow-black/40">
          <FlameButton onClick={save}>Save schema</FlameButton>
        </div>
      </div>
    </div>
  );
}

