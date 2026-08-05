import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, ShieldAlert, ShieldCheck, Inbox, Search, Eye } from "lucide-react";
import { submissionsApi, type ContactSubmission } from "@/lib/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Filter = "all" | "ham" | "spam";

export default function AdminSubmissions() {
  const [items, setItems] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ContactSubmission | null>(null);
  const [deleting, setDeleting] = useState<ContactSubmission | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = () => {
    setLoading(true);
    submissionsApi.list({ page, limit, filter, q: qDebounced })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, filter, qDebounced]);

  async function toggleSpam(s: ContactSubmission) {
    try {
      await submissionsApi.setSpam(s.id, !s.isSpam);
      toast.success(s.isSpam ? "Marked as not spam" : "Marked as spam");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  }
  async function handleDelete() {
    if (!deleting) return;
    try { await submissionsApi.remove(deleting.id); toast.success("Submission deleted"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6" /> Submissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact form messages. Honeypot &amp; math-failed entries are stored here as spam and never emailed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search…"
              className="h-9 w-56 rounded-md border border-white/10 bg-background pl-8 pr-8 text-sm"
            />
            <SearchClearButton show={!!q} onClear={() => { setQ(""); setPage(1); }} />
          </div>
          <div className="inline-flex rounded-md border border-white/10 overflow-hidden text-sm">
            {(["all", "ham", "spam"] as Filter[]).map((f) => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 capitalize ${filter === f ? "bg-[color:var(--flame)] text-white" : "text-muted-foreground hover:bg-white/5"}`}>
                {f === "ham" ? "Clean" : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="text-left px-4 py-3">From</th>
              <th className="text-left px-4 py-3">Message</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Received</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No submissions yet.</td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-b border-white/5 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                  {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                </td>
                <td className="px-4 py-3 max-w-[420px]">
                  <button onClick={() => setOpen(s)} className="text-left line-clamp-2 hover:text-[color:var(--flame-light)]">
                    {s.message}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {s.isSpam ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-300 px-2 py-0.5 text-[11px]">
                      <ShieldAlert className="h-3 w-3" /> Spam{s.spamReason ? ` · ${s.spamReason}` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[11px]">
                      <ShieldCheck className="h-3 w-3" /> Clean
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setOpen(s)}
                    title="View submission"
                    className="text-xs text-muted-foreground hover:text-white px-2 py-1 inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  <button onClick={() => toggleSpam(s)}
                    className="text-xs text-muted-foreground hover:text-white px-2 py-1">
                    {s.isSpam ? "Not spam" : "Spam"}
                  </button>
                  <button onClick={() => setDeleting(s)}
                    className="text-xs text-red-300 hover:text-red-200 px-2 py-1 inline-flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-md border border-white/10 disabled:opacity-40">Prev</button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border border-white/10 disabled:opacity-40">Next</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-[color:var(--card)] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{open.name}</div>
                <div className="text-sm text-muted-foreground">{open.email}{open.phone ? ` · ${open.phone}` : ""}</div>
              </div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-white text-sm">Close</button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap text-sm bg-background/60 border border-white/10 rounded-lg p-3 max-h-[50vh] overflow-auto">{open.message}</pre>
            {open.sentTo && (
              <div className="mt-3 text-xs">
                <div className="text-muted-foreground mb-1">Notification sent to:</div>
                <div className="flex flex-wrap gap-1.5">
                  {open.sentTo.split(/[,;]\s*/).filter(Boolean).map((e) => (
                    <span key={e} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5">{e}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <div>Received: {new Date(open.createdAt).toLocaleString()}</div>
              <div>IP: {open.ip || "—"} · UA: {open.userAgent || "—"}</div>
              {open.isSpam && <div className="text-red-300">Flagged as spam ({open.spamReason || "unknown"}).</div>}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
