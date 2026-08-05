import { useEffect, useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { request, type AdminMe } from "@/lib/api";
import { adminApi } from "@/lib/api";
import { formatCA } from "@/lib/datetime";

type StaffUser = { id: number; username: string; full_name: string | null; role: string; is_super: 0 | 1 };
type AttendanceRow = {
  id: number;
  user_id: number;
  username: string;
  full_name: string | null;
  check_in_at: string;
  check_out_at: string | null;
  source: "login_modal" | "manual" | "auto";
  notes: string | null;
  work_date: string;
};

function todayCA() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function daysAgoCA(days: number) {
  const d = new Date(Date.now() - days * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function durationMs(fromIso: string, toIso: string | null): number {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  return Math.max(0, to - from);
}
function fmtDur(ms: number) {
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAttendance({ from: fromProp, to: toProp }: { from?: string; to?: string } = {}) {
  const embedded = fromProp !== undefined && toProp !== undefined;
  const [me, setMe] = useState<AdminMe | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [userId, setUserId] = useState<number | "">("");
  const [fromLocal, setFromLocal] = useState(daysAgoCA(29));
  const [toLocal, setToLocal] = useState(todayCA());
  const from = embedded ? (fromProp as string) : fromLocal;
  const to = embedded ? (toProp as string) : toLocal;
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  // 30-second tick so open shifts update their live duration.
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qUser = params.get("user");
    adminApi.me().then((r) => {
      setMe(r.user);
      setUserId(qUser ? Number(qUser) : r.user.id);
    }).catch(() => { if (qUser) setUserId(Number(qUser)); });
    request<{ items: StaffUser[] }>("/admin/attendance/users")
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]));
  }, []);


  useEffect(() => {
    if (userId === "" || !from || !to) return;
    setLoading(true);
    const qs = new URLSearchParams({ user_id: String(userId), from, to, limit: "500" }).toString();
    request<{ items: AttendanceRow[] }>(`/admin/attendance?${qs}`)
      .then((r) => setRows(r.items))
      .catch((e) => { toast.error(e instanceof Error ? e.message : "Failed to load"); setRows([]); })
      .finally(() => setLoading(false));
  }, [userId, from, to]);

  const summary = useMemo(() => {
    const closed = rows.filter((r) => r.check_out_at);
    const totalMs = closed.reduce((s, r) => s + durationMs(r.check_in_at, r.check_out_at), 0);
    const days = new Set(rows.map((r) => r.work_date)).size;
    const avg = closed.length ? totalMs / closed.length : 0;
    return { days, totalMs, avg, open: rows.filter((r) => !r.check_out_at).length };
  }, [rows]);

  const selectedUser = users.find((u) => u.id === userId);
  const canEdit = !!me?.is_super;

  async function forceClose(id: number) {
    if (!canEdit) return;
    if (!confirm("Force close this open shift now?")) return;
    try {
      await request(`/admin/attendance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ check_out_at: new Date().toISOString().slice(0, 19).replace("T", " "), notes: "manually closed" }),
      });
      toast.success("Shift closed");
      const qs = new URLSearchParams({ user_id: String(userId), from, to, limit: "500" }).toString();
      const r = await request<{ items: AttendanceRow[] }>(`/admin/attendance?${qs}`);
      setRows(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold">Staff Attendance</h1>
            <p className="text-sm text-muted-foreground">Check-in and check-out log per staff member (America/Toronto).</p>
          </div>
        ) : <div />}
        <Button
          variant="outline" size="sm"
          onClick={() => downloadCsv(
            `attendance-${selectedUser?.username || "user"}-${from}_${to}.csv`,
            [
              ["Date", "User", "Check-in", "Check-out", "Duration", "Source", "Notes"],
              ...rows.map((r) => [
                r.work_date,
                r.full_name || r.username,
                formatCA(r.check_in_at),
                r.check_out_at ? formatCA(r.check_out_at) : "(open)",
                r.check_out_at ? fmtDur(durationMs(r.check_in_at, r.check_out_at)) : "",
                r.source,
                r.notes || "",
              ]),
            ],
          )}
          disabled={!rows.length}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Staff</Label>

          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}
            className="h-9 rounded-md border border-input bg-card text-foreground px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-card [&>option]:text-foreground min-w-[200px]"
            style={{ colorScheme: "dark" }}
          >
            <option value="">— Select —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.username}{u.is_super ? " (Super Admin)" : ` (${u.role})`}
              </option>
            ))}
          </select>
        </div>
        {!embedded && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Days worked" value={String(summary.days)} />
        <Stat label="Total hours" value={fmtDur(summary.totalMs)} />
        <Stat label="Avg shift" value={summary.avg ? fmtDur(summary.avg) : "—"} />
        <Stat label="Open shifts" value={String(summary.open)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedUser ? `Log — ${selectedUser.full_name || selectedUser.username}` : "Log"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Notes</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-6">
                  {userId === "" ? "Pick a staff member above." : "No attendance in range."}
                </TableCell></TableRow>
              )}
              {rows.map((r) => {
                const open = !r.check_out_at;
                const durMs = durationMs(r.check_in_at, r.check_out_at);
                return (
                  <TableRow key={r.id} className={open ? "bg-[color:var(--flame)]/5" : undefined}>
                    <TableCell className="whitespace-nowrap">{r.work_date}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatCA(r.check_in_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {open ? (
                        <span className="text-[color:var(--flame-light)]">open</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {formatCA(r.check_out_at!)}
                          {r.source === "auto" && (r.notes || "").includes("auto-logout after 8h") && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-amber-400 cursor-help" aria-label="Auto logout info" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  Log out time was captured automatically because the user failed to log out (8 hours after check-in).
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-mono text-xs">
                      {fmtDur(durMs)}{open && <span className="text-muted-foreground ml-1">(live)</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        r.source === "login_modal" ? "bg-emerald-500/15 text-emerald-300" :
                        r.source === "manual" ? "bg-amber-500/15 text-amber-300" :
                        "bg-red-500/15 text-red-300"
                      }`}>{r.source.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={r.notes || ""}>{r.notes || "—"}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        {open && (
                          <Button size="sm" variant="outline" onClick={() => forceClose(r.id)}>Close now</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Times are shown in Canadian Eastern time (America/Toronto). Open shifts update every 30 seconds.
        Dangling shifts from prior days are auto-closed when the user checks in again.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
