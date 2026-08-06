import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Play, Plus, Trash2 } from "lucide-react";
import { adminApi, resolveAssetUrl, type SiteSettings, type AdminMe } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import {
  NOTIFICATION_RULES_KEY, TRIGGERS, parseRules, serializeRules,
  type NotificationRule, type TriggerId,
} from "@/lib/notification-rules";
import { TONES, playTone, type ToneId } from "@/lib/notification-sounds";

type Field = {
  k: string;
  label: string;
  type?: "image" | "password" | "select" | "toggle" | "textarea" | "mode_toggle" | "mode_scoped" | "mode_scoped_password" | "generate_key";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
};

const SECTIONS: Array<{ id: string; title: string; description?: string; fields: Field[] }> = [
  {
    id: "site",
    title: "Site Settings",
    description: "Brand identity and store-wide defaults.",
    fields: [
      { k: "site_title", label: "Site title" },
      { k: "site_tagline", label: "Tagline" },
      { k: "logo_url", label: "Logo", type: "image" },
      { k: "favicon_url", label: "Favicon", type: "image" },
      { k: "announcement_text", label: "Announcement bar text" },
      { k: "announcement_speed", label: "Announcement scroll speed (seconds per loop, lower = faster)", placeholder: "18", help: "Default 18. Try 10 for faster, 30 for slower." },
    ],
  },
  {
    id: "contact",
    title: "Contact Settings",
    description: "How customers reach you.",
    fields: [
      { k: "contact_email", label: "Contact email" },
      { k: "contact_phone", label: "Contact phone" },
      { k: "contact_whatsapp", label: "WhatsApp" },
      { k: "contact_address", label: "Address" },
    ],
  },
  {
    id: "business",
    title: "Business / Tax Settings",
    description: "Used on invoices and the storefront where required.",
    fields: [
      { k: "business_legal_name", label: "Legal business name" },
      { k: "gst_number", label: "GST/HST number" },
      { k: "gst_rate_percent", label: "Tax rate (%)" },
      { k: "hsn_code", label: "HSN code (default)" },
    ],
  },
  {
    id: "payments",
    title: "Payment Settings",
    description: "Connect a bank gateway or third-party processor to accept online payments. Currently disabled — fill in credentials to enable later.",
    fields: [
      { k: "payments_enabled", label: "Enable online payments", type: "toggle" },
      { k: "payments_provider", label: "Provider", type: "select", options: [
        { value: "", label: "— Not configured —" },
        { value: "stripe", label: "Stripe" },
        { value: "square", label: "Square" },
        { value: "paypal", label: "PayPal" },
        { value: "razorpay", label: "Razorpay" },
        { value: "moneris", label: "Moneris (Bank of Canada)" },
        { value: "bank", label: "Direct bank API" },
        { value: "other", label: "Other" },
      ]},
      { k: "payments_mode", label: "Mode", type: "select", options: [
        { value: "test", label: "Test / Sandbox" },
        { value: "live", label: "Live" },
      ]},
      { k: "payments_public_key", label: "Public / Publishable key", placeholder: "pk_..." },
      { k: "payments_secret_key", label: "Secret / API key", type: "password", placeholder: "sk_..." },
      { k: "payments_webhook_secret", label: "Webhook signing secret", type: "password" },
      { k: "payments_merchant_id", label: "Merchant ID" },
      { k: "payments_account_id", label: "Account / Store ID" },
      { k: "payments_notes", label: "Notes (internal)", type: "textarea" },
    ],
  },
  {
    id: "social",
    title: "Social Media Settings",
    description: "Links shown in the footer and share metadata.",
    fields: [
      { k: "social_instagram", label: "Instagram URL" },
      { k: "social_facebook", label: "Facebook URL" },
      { k: "social_pinterest", label: "Pinterest URL" },
      { k: "social_youtube", label: "YouTube URL" },
    ],
  },
  {
    id: "delivery",
    title: "Delivery Settings (Uber Direct)",
    description: "Configure on-demand local delivery via Uber Direct. Delivery stays off until you flip the Enable switch. Sandbox and Live credentials are stored separately — flipping the mode toggle switches which set is used without losing the other. Register this webhook URL in the Uber Direct dashboard: /api/delivery/webhook (append to your API domain).",
    fields: [
      { k: "delivery_enabled", label: "Enable delivery", type: "toggle" },
      { k: "delivery_mode", label: "API mode (Sandbox ↔ Live)", type: "mode_toggle" },
      { k: "uber_customer_id", label: "Uber Customer ID", type: "mode_scoped", placeholder: "cus_..." },
      { k: "uber_client_id", label: "Uber Client ID", type: "mode_scoped" },
      { k: "uber_client_secret", label: "Uber Client Secret", type: "mode_scoped_password" },
      { k: "uber_webhook_signing_key", label: "Webhook signing key", type: "mode_scoped_password", help: "From the Uber Direct dashboard. Used to verify incoming status webhooks." },
      { k: "delivery_pickup_name", label: "Pickup contact name", placeholder: "Flames Gourmet" },
      { k: "delivery_pickup_phone", label: "Pickup contact phone", placeholder: "+1 416 555 0123" },
      { k: "delivery_pickup_address", label: "Pickup address", placeholder: "Street, City, Province, Postal Code", help: "Required by Uber on every request even though your store is configured in the Uber portal." },
      { k: "delivery_max_radius_km", label: "Max delivery radius (km)", placeholder: "1" },
      { k: "delivery_packaging_fee", label: "Packaging charges ($)", placeholder: "0.00", help: "Flat fee added to every delivery order total. Leave blank or 0 for none." },
    ],
  },
];

const ATTENDANCE_SECTION: { id: string; title: string; description?: string; fields: Field[] } = {
  id: "attendance",
  title: "Attendance Sync (Super Admin)",
  description: "Share attendance check-in / check-out data with another web app. Generate an API key here and share it with the other app — they call GET /api/attendance/sync with `Authorization: Bearer <key>`. Optionally set a webhook URL to receive real-time push events (signed with HMAC-SHA256 using the same key in the `X-Signature` header).",
  fields: [
    { k: "attendance_sync_api_key", label: "Sync API key", type: "generate_key", help: "Click Generate to create a new 64-char random key. The previous key stops working immediately." },
    { k: "attendance_webhook_url", label: "Webhook URL (optional)", placeholder: "https://other-app.example.com/hooks/attendance", help: "Leave blank to disable real-time push. Polling via the sync API still works." },
  ],
};

const AI_SECTION: { id: string; title: string; description?: string; fields: Field[] } = {
  id: "ai",
  title: "AI Providers (Super Admin)",
  description: "Configure the Xpert assistant with one or more providers. Requests try providers in the fallback order; on rate-limit/5xx/auth errors the next provider is tried automatically. Changes take effect immediately.",
  fields: [
    { k: "ai_fallback_order", label: "Fallback order (comma-separated)", placeholder: "groq,gemini,openai,deepseek", help: "Providers tried left → right. Only providers with an API key are used. Groq is free and recommended as the default." },

    { k: "ai_gemini_key", label: "Google Gemini API key", type: "password", placeholder: "AIza…" },
    { k: "ai_gemini_model", label: "Gemini model", placeholder: "gemini-2.5-flash" },

    { k: "ai_groq_key", label: "Groq API key", type: "password", placeholder: "gsk_…" },
    { k: "ai_groq_model", label: "Groq model", placeholder: "llama-3.3-70b-versatile" },

    { k: "ai_openai_key", label: "OpenAI API key", type: "password", placeholder: "sk-…" },
    { k: "ai_openai_model", label: "OpenAI model", placeholder: "gpt-4o-mini" },

    { k: "ai_deepseek_key", label: "DeepSeek API key", type: "password", placeholder: "sk-…" },
    { k: "ai_deepseek_model", label: "DeepSeek model", placeholder: "deepseek-chat" },
  ],
};


export default function AdminSettings() {
  const [data, setData] = useState<SiteSettings>({});
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try { return localStorage.getItem("flames.settings.tab") || "site"; } catch { return "site"; }
  });
  useEffect(() => { adminApi.getSettings().then((r) => setData(r.settings)).catch(() => {}); }, []);
  useEffect(() => { adminApi.me().then((r) => setMe(r.user)).catch(() => setMe(null)); }, []);
  useEffect(() => { try { localStorage.setItem("flames.settings.tab", activeTab); } catch { /* ignore */ } }, [activeTab]);
  async function save() {
    setBusy(true);
    try { await adminApi.saveSettings(data); toast.success("Saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const NOTIFICATIONS_SECTION = {
    id: "notifications",
    title: "Notifications",
    description: "Add a sound notification for an order event. Each event can have one sound; it plays once when the event happens.",
    fields: [] as Field[],
  };

  const tabs = [
    ...SECTIONS.filter((s) => s.id !== "delivery" || me?.is_super),
    NOTIFICATIONS_SECTION,
    ...(me?.is_super ? [ATTENDANCE_SECTION, AI_SECTION] : []),
  ];
  const active = tabs.find((t) => t.id === activeTab) || tabs[0];

  const SaveButton = (
    <button onClick={save} disabled={busy}
      className="rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? "Saving…" : "Save all settings"}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Brand, contact, business and social settings used across the website.</p>
        </div>
        {SaveButton}
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-white/10">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active?.id === t.id
                ? "border-[color:var(--flame)] text-white"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}>
            {t.title.replace(/\s*Settings\s*/i, "").trim() || t.title}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-4 rounded-2xl border border-white/5 bg-[color:var(--card)] p-5">
          {active.description && <p className="mb-4 text-sm text-muted-foreground">{active.description}</p>}
          {active.id === "notifications"
            ? <NotificationsSection data={data} setData={setData} />
            : <SectionGrid fields={active.fields} data={data} setData={setData} />}
        </div>
      )}

      <div className="mt-4 flex justify-end">{SaveButton}</div>
    </div>
  );
}


function SectionGrid({ fields, data, setData }: { fields: Field[]; data: SiteSettings; setData: (d: SiteSettings) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        if (f.type === "generate_key") {
          return <GenerateKeyField key={f.k} field={f} data={data} setData={setData} />;
        }
        if (f.type === "image") {
          const url = data[f.k] || "";
          return (
            <div key={f.k}>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-md border border-white/10 bg-background">
                  {url ? <OptimizedImage src={url} alt="" width={56} height={56} fit="contain" className="h-full w-full object-contain" /> : <div className="h-full w-full" />}
                </div>
                <MediaPickerButton
                  hasValue={!!url}
                  addLabel={`Add ${f.label.toLowerCase()}`}
                  replaceLabel={`Replace ${f.label.toLowerCase()}`}
                  onPick={(picked) => setData({ ...data, [f.k]: picked })}
                />
                {url && (
                  <button onClick={() => setData({ ...data, [f.k]: "" })} className="text-xs text-destructive hover:underline">Clear</button>
                )}
              </div>
              <input value={url} onChange={(e) => setData({ ...data, [f.k]: e.target.value })}
                placeholder="/uploads/file.jpg or https://…"
                className="mt-2 h-9 w-full rounded-md border border-white/10 bg-background px-2 text-xs font-mono" />
            </div>
          );
        }
        if (f.type === "toggle") {
          const on = data[f.k] === "1" || data[f.k] === "true";
          return (
            <label key={f.k} className="flex items-center gap-3 sm:col-span-2">
              <input type="checkbox" checked={on}
                onChange={(e) => setData({ ...data, [f.k]: e.target.checked ? "1" : "0" })}
                className="h-4 w-4 accent-[color:var(--flame)]" />
              <span className="text-sm">{f.label}</span>
            </label>
          );
        }
        if (f.type === "mode_toggle") {
          const isLive = data[f.k] === "live";
          return (
            <div key={f.k} className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">
                  Currently using <span className={isLive ? "text-[color:var(--flame)] font-semibold" : "font-semibold"}>{isLive ? "LIVE" : "SANDBOX"}</span> credentials. Both sets stay saved.
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={!isLive ? "font-semibold" : "text-muted-foreground"}>Sandbox</span>
                <button type="button" role="switch" aria-checked={isLive}
                  onClick={() => setData({ ...data, [f.k]: isLive ? "sandbox" : "live" })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${isLive ? "bg-[color:var(--flame)]" : "bg-input"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isLive ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className={isLive ? "font-semibold" : "text-muted-foreground"}>Live</span>
              </div>
            </div>
          );
        }
        if (f.type === "mode_scoped" || f.type === "mode_scoped_password") {
          const mode = data["delivery_mode"] === "live" ? "live" : "sandbox";
          const scopedKey = `${f.k}_${mode}`;
          const value = data[scopedKey] || (mode === "sandbox" ? (data[f.k] ?? "") : "");
          return (
            <label key={f.k} className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {f.label} <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{mode}</span>
              </div>
              <input
                type={f.type === "mode_scoped_password" ? "password" : "text"}
                value={value}
                onChange={(e) => setData({ ...data, [scopedKey]: e.target.value })}
                placeholder={f.placeholder}
                autoComplete={f.type === "mode_scoped_password" ? "new-password" : undefined}
                className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
              {f.help && <div className="mt-1 text-[11px] text-muted-foreground">{f.help}</div>}
            </label>
          );
        }
        if (f.type === "select") {
          return (
            <label key={f.k} className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</div>
              <select value={data[f.k] || ""} onChange={(e) => setData({ ...data, [f.k]: e.target.value })}
                className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm">
                {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        }
        if (f.type === "textarea") {
          return (
            <label key={f.k} className="block sm:col-span-2">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</div>
              <textarea value={data[f.k] || ""} onChange={(e) => setData({ ...data, [f.k]: e.target.value })}
                rows={3} className="w-full rounded-md border border-white/10 bg-background px-2 py-1.5 text-sm" />
            </label>
          );
        }
        return (
          <label key={f.k} className="block">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <input
              type={f.type === "password" ? "password" : "text"}
              value={data[f.k] || ""}
              onChange={(e) => setData({ ...data, [f.k]: e.target.value })}
              placeholder={f.placeholder}
              autoComplete={f.type === "password" ? "new-password" : undefined}
              className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
          </label>
        );
      })}
    </div>
  );
}

function GenerateKeyField({ field, data, setData }: { field: Field; data: SiteSettings; setData: (d: SiteSettings) => void }) {
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const stored = data[field.k] || "";
  const isMasked = /^\*+$/.test(stored);
  const display = revealed ?? (isMasked ? stored : stored ? "•".repeat(Math.min(stored.length, 48)) : "");

  async function generate() {
    if (!confirm("Generate a new API key? The current key will stop working immediately.")) return;
    setBusy(true);
    try {
      const { key } = await adminApi.generateAttendanceSyncKey();
      setRevealed(key);
      setData({ ...data, [field.k]: key });
      toast.success("New key generated — copy it now, it won't be shown again after save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!revealed) return;
    try { await navigator.clipboard.writeText(revealed); toast.success("Copied"); }
    catch { toast.error("Copy failed"); }
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{field.label}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={display}
          placeholder="No key generated yet"
          className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-background px-2 font-mono text-xs" />
        <button type="button" onClick={generate} disabled={busy}
          className="h-9 rounded-md bg-[color:var(--flame)] px-3 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? "Generating…" : stored ? "Regenerate" : "Generate"}
        </button>
        {revealed && (
          <button type="button" onClick={copy}
            className="h-9 rounded-md border border-white/10 px-3 text-xs font-semibold hover:bg-white/5">
            Copy
          </button>
        )}
      </div>
      {field.help && <div className="mt-1 text-[11px] text-muted-foreground">{field.help}</div>}
      {revealed && <div className="mt-1 text-[11px] text-amber-400">This is the only time the full key is shown. Copy it now.</div>}
    </div>
  );
}
