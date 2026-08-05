import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Mail, Upload, UserPlus, Send, Trash2, FilePlus, Pencil, Save, Sparkles, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { newsletterApi, fetchSiteSettings, resolveAssetUrl, type NewsletterSubscriber, type NewsletterTemplate, type NewsletterCampaign } from "@/lib/api";
import { buildSeedTemplates } from "@/lib/newsletterTemplates";
import RichTextEditor from "@/components/admin/RichTextEditor";

const DEFAULT_HTML = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#faf3ec;font-family:Georgia,serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px;text-align:center;border-bottom:1px solid #f0e6dc;">
          <h1 style="margin:0;font-size:26px;letter-spacing:3px;color:#7a1f1f;">FLAMES GOURMET</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:22px;">A note from our kitchen</h2>
          <p style="margin:0 0 16px;line-height:1.6;color:#444;">Replace this with your story, a new dish, or a special offer.</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="#" style="background:#7a1f1f;color:#fff;padding:14px 28px;text-decoration:none;letter-spacing:2px;font-size:12px;">ORDER NOW</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

type Tab = "compose" | "templates" | "subscribers" | "history";

export default function AdminNewsletter() {
  const [tab, setTab] = useState<Tab>("compose");
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [audience, setAudience] = useState({ subscribers: 0 });

  // Compose
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [selectedTpl, setSelectedTpl] = useState("");
  const [sending, setSending] = useState(false);

  // Template editor
  const [tplEditor, setTplEditor] = useState<{ id: number | null; name: string; subject: string; html: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Subscribers (mailing list)
  const [subs, setSubs] = useState<NewsletterSubscriber[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [editingSub, setEditingSub] = useState<NewsletterSubscriber | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadCore() {
    const tasks: { label: string; run: () => Promise<void> }[] = [
      { label: "templates", run: async () => { const r = await newsletterApi.listTemplates(); setTemplates(r.items); } },
      { label: "campaigns", run: async () => { const r = await newsletterApi.listCampaigns(); setCampaigns(r.items); } },
      { label: "audience",  run: async () => { const r = await newsletterApi.audienceStats(); setAudience(r); } },
    ];
    const results = await Promise.allSettled(tasks.map((t) => t.run()));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        toast.error(`Failed to load ${tasks[i].label}: ${msg}`);
      }
    });
  }
  async function loadSubs() {
    try {
      const r = await newsletterApi.listSubscribers({ page, limit, q: searchDebounced || undefined });
      setSubs(r.items); setSubTotal(r.total);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load list"); }
  }
  useEffect(() => { loadCore(); }, []);
  useEffect(() => { loadSubs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, limit, searchDebounced]);
  useEffect(() => {
    const id = setTimeout(() => { setSearchDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(subTotal / limit));

  function onLoadTemplate(id: string) {
    setSelectedTpl(id);
    if (!id) return;
    const t = templates.find((x) => x.id === Number(id));
    if (!t) return;
    setHtml(t.html); if (t.subject) setSubject(t.subject);
    toast.success(`Loaded "${t.name}"`);
  }

  async function saveTemplate() {
    if (!tplEditor) return;
    if (!tplEditor.name.trim()) return toast.error("Template name is required");
    if (!tplEditor.html.trim()) return toast.error("Template body is empty");
    try {
      if (tplEditor.id) {
        await newsletterApi.updateTemplate(tplEditor.id, { name: tplEditor.name.trim(), subject: tplEditor.subject, html: tplEditor.html });
        toast.success("Template updated");
      } else {
        await newsletterApi.createTemplate({ name: tplEditor.name.trim(), subject: tplEditor.subject, html: tplEditor.html });
        toast.success("Template saved");
      }
      setTplEditor(null);
      await loadCore();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  }
  async function deleteTemplate(id: number) {
    if (!confirm("Delete this template?")) return;
    try { await newsletterApi.deleteTemplate(id); toast.success("Deleted"); await loadCore(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function seedPredesigned() {
    setSeeding(true);
    try {
      const s = await fetchSiteSettings();
      const rawLogo = s.logo_url ? resolveAssetUrl(s.logo_url) : "";
      const absLogo = rawLogo ? (rawLogo.startsWith("http") ? rawLogo : `${window.location.origin}${rawLogo.startsWith("/") ? "" : "/"}${rawLogo}`) : "";
      const siteUrl = s.site_url || window.location.origin;
      const seeds = buildSeedTemplates({ logoUrl: absLogo, siteUrl });
      const byName = new Map(templates.map((t) => [t.name.toLowerCase(), t]));
      let added = 0, updated = 0;
      for (const t of seeds) {
        const existing = byName.get(t.name.toLowerCase());
        if (existing) {
          await newsletterApi.updateTemplate(existing.id, t); updated++;
        } else {
          await newsletterApi.createTemplate(t); added++;
        }
      }
      toast.success(`Added ${added}${updated ? ` · refreshed ${updated}` : ""}`);
      await loadCore();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSeeding(false); }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await newsletterApi.addSubscriber(newEmail.trim(), newName.trim() || undefined);
      toast.success("Added to mailing list");
      setNewEmail(""); setNewName("");
      await Promise.all([loadSubs(), loadCore()]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
    finally { setAdding(false); }
  }
  async function onDelete(id: number) {
    if (!confirm("Remove this contact?")) return;
    try { await newsletterApi.deleteSubscriber(id); toast.success("Removed"); await Promise.all([loadSubs(), loadCore()]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function saveEdit() {
    if (!editingSub) return;
    try {
      await newsletterApi.updateSubscriber(editingSub.id, { email: editingSub.email, name: editingSub.name });
      toast.success("Updated");
      setEditingSub(null);
      await loadSubs();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const items = parseRows(rows);
      if (items.length === 0) return toast.error("No valid emails found");
      const r = await newsletterApi.importSubscribers(items);
      toast.success(`Imported ${r.added}, skipped ${r.skipped}`);
      await Promise.all([loadSubs(), loadCore()]);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function onSend() {
    if (!subject.trim()) return toast.error("Enter a subject");
    if (!html.trim()) return toast.error("Email body is empty");
    if (!confirm(`Send to ${audience.subscribers} contact(s)?`)) return;
    setSending(true);
    try {
      const r = await newsletterApi.send({ subject: subject.trim(), html });
      toast.success(`Sent: ${r.sent} · Failed: ${r.failed}`);
      await loadCore();
      setTab("history");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); }
    finally { setSending(false); }
  }

  const tabs: { k: Tab; label: string }[] = useMemo(() => [
    { k: "compose", label: "Compose & Send" },
    { k: "templates", label: `Templates (${templates.length})` },
    { k: "subscribers", label: `Mailing List (${subTotal})` },
    { k: "history", label: "History" },
  ], [templates.length, subTotal]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6" /> Newsletter</h1>
        <p className="mt-1 text-sm text-muted-foreground">Design HTML campaigns and send to your mailing list.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.k ? "border-[color:var(--flame)] text-white" : "border-transparent text-muted-foreground hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</div>
                <input value={subject} maxLength={255} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your subject line"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Load template</div>
                <select value={selectedTpl} onChange={(e) => onLoadTemplate(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">— Choose a saved template —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Email body</div>
              <RichTextEditor value={html} onChange={setHtml} minHeight={460} />
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">Preview rendered email</summary>
                <iframe title="preview" srcDoc={html} sandbox="" className="mt-2 h-[460px] w-full rounded-md border bg-white" />
              </details>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Audience</div>
              <div className="mt-2 rounded-md border bg-background px-3 py-2 text-sm flex items-center justify-between">
                <span>Mailing list subscribers</span>
                <span className="text-xs text-muted-foreground">{audience.subscribers}</span>
              </div>
            </div>
            <button onClick={onSend} disabled={sending || audience.subscribers === 0}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--flame)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : `Send to ${audience.subscribers} contact${audience.subscribers === 1 ? "" : "s"}`}
            </button>
            <p className="text-[11px] text-muted-foreground">Tip: Save layouts under Templates and reuse them here.</p>
          </div>
        </section>
      )}

      {tab === "templates" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Predesigned festival layouts you can load into Compose & Send.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={seedPredesigned} disabled={seeding}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                <Sparkles className="h-3.5 w-3.5" /> {seeding ? "Adding…" : "Load predesigned (Canadian, Christian & Poila Baisakh)"}
              </button>
              <button onClick={() => setTplEditor({ id: null, name: "", subject: "", html: DEFAULT_HTML })}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--flame)] px-3 py-2 text-xs font-semibold text-white">
                <FilePlus className="h-3.5 w-3.5" /> New template
              </button>
            </div>
          </div>
          {templates.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No templates yet. Click “Load predesigned” to add Canada Day, Thanksgiving, Christmas, Easter, and Poila Baisakh layouts.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((t) => (
                <div key={t.id} className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="relative aspect-[3/4] overflow-hidden border-b bg-white">
                    <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: "250%", height: "250%", transform: "scale(0.4)" }}>
                      <iframe title={`Preview ${t.name}`} srcDoc={t.html} sandbox="" className="h-full w-full border-0 bg-white" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.subject || "No subject"}</div>
                  </div>
                  <div className="flex gap-1 border-t p-2">
                    <button onClick={() => { setTab("compose"); onLoadTemplate(String(t.id)); }}
                      className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary">Use</button>
                    <button onClick={() => setTplEditor({ id: t.id, name: t.name, subject: t.subject, html: t.html })}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => deleteTemplate(t.id)}
                      className="rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tplEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{tplEditor.id ? "Edit template" : "New template"}</h2>
                  <button onClick={() => setTplEditor(null)} className="text-sm text-muted-foreground hover:text-white">Close</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</div>
                    <input value={tplEditor.name} maxLength={160}
                      onChange={(e) => setTplEditor((s) => s && { ...s, name: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Default subject</div>
                    <input value={tplEditor.subject} maxLength={255}
                      onChange={(e) => setTplEditor((s) => s && { ...s, subject: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  </label>
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Body</div>
                  <RichTextEditor
                    value={tplEditor.html}
                    onChange={(v) => setTplEditor((s) => s && { ...s, html: v })}
                    minHeight={380}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setTplEditor(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                  <button onClick={saveTemplate}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--flame)] px-3 py-2 text-sm font-semibold text-white">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "subscribers" && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form onSubmit={onAdd} className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4" /> Add a contact</h2>
              <div className="mt-3 space-y-2">
                <input required type="email" placeholder="Email" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
                <input placeholder="Name (optional)" value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
                <button disabled={adding} type="submit"
                  className="w-full rounded-md bg-[color:var(--flame)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {adding ? "Adding…" : "Add to mailing list"}
                </button>
              </div>
            </form>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" /> Import from CSV or Excel</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Columns: <code>email</code> (required), <code>name</code> (optional). Accepts .csv, .xlsx, .xls.
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onImport}
                className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-secondary" />
              {importing && <div className="mt-2 text-xs text-muted-foreground">Importing…</div>}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const r = await newsletterApi.importCustomers();
                    toast.success(`Imported ${r.added} customer${r.added === 1 ? "" : "s"}, skipped ${r.skipped}`);
                    loadSubs();
                  } catch (err) { toast.error(err instanceof Error ? err.message : "Import failed"); }
                }}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-secondary"
              >
                Import from customer accounts
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm" />
              <SearchClearButton show={!!search} onClear={() => setSearch("")} />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              View
              <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {[25, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{s.name || "—"}</td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditingSub(s)}
                        className="mr-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(s.id)}
                        className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {subs.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No contacts on the list.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing {subs.length === 0 ? 0 : (page - 1) * limit + 1}–{(page - 1) * limit + subs.length} of {subTotal}
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="px-2">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {editingSub && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl">
                <h2 className="mb-3 text-lg font-semibold">Edit contact</h2>
                <div className="space-y-3">
                  <label className="block text-sm">
                    <div className="mb-1 text-xs text-muted-foreground">Name</div>
                    <input value={editingSub.name || ""}
                      onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2" />
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-xs text-muted-foreground">Email</div>
                    <input type="email" value={editingSub.email}
                      onChange={(e) => setEditingSub({ ...editingSub, email: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2" />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setEditingSub(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                  <button onClick={saveEdit}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--flame)] px-3 py-2 text-sm font-semibold text-white">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Sent</th>
                <th className="px-3 py-2 text-left">Failed</th>
                <th className="px-3 py-2 text-left">By</th>
                <th className="px-3 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.subject}</td>
                  <td className="px-3 py-2">{c.sent_count}</td>
                  <td className="px-3 py-2 text-destructive">{c.failed_count}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.sent_by || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(c.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No campaigns sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function parseRows(rows: Array<Record<string, unknown>>): Array<{ email: string; name?: string }> {
  const out: Array<{ email: string; name?: string }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const keys = Object.keys(row);
    const emailKey = keys.find((k) => k.toLowerCase().trim() === "email") || keys.find((k) => /mail/i.test(k));
    const nameKey = keys.find((k) => k.toLowerCase().trim() === "name") || keys.find((k) => /name/i.test(k));
    const email = String(emailKey ? row[emailKey] : keys[0] ? row[keys[0]] : "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    const name = nameKey ? String(row[nameKey] ?? "").trim() : "";
    out.push(name ? { email, name } : { email });
  }
  return out;
}
