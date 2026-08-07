/**
 * Staff attendance / shift tracking.
 * - openAttendance / closeAttendance are called from the auth flow.
 * - Admin endpoints under this router are mounted at /admin/attendance.
 * - Public sync router (attendanceSyncRouter) is mounted at /api/attendance
 *   and lets an external app pull records (poll `?since=<ISO>`) or receive
 *   push events via the ATTENDANCE_WEBHOOK_URL env var.
 */
import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { pool } from "../db.js";



const CA_TZ = "America/Toronto";

/** YYYY-MM-DD for a given Date in America/Toronto. */
function caDateStr(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Marker text stored in `notes` when a shift is auto-closed at +8h. */
export const AUTO_LOGOUT_NOTE = "auto-logout after 8h — user did not log out";

/**
 * Sweep dangling attendance rows. Any row still open 8+ hours after
 * check-in is closed with check_out_at = check_in_at + 8h, source='auto',
 * and the AUTO_LOGOUT_NOTE marker appended to notes. Idempotent & cheap
 * (bounded UPDATE); safe to call from any read/write path.
 */
export async function sweepStaleAttendance() {
  try {
    await pool.query(
      `UPDATE staff_attendance
          SET check_out_at = check_in_at + INTERVAL 8 HOUR,
              source = 'auto',
              notes = CONCAT(COALESCE(notes,''), IF(notes IS NULL OR notes='','','; '), ?)
        WHERE check_out_at IS NULL
          AND check_in_at < (NOW() - INTERVAL 8 HOUR)`,
      [AUTO_LOGOUT_NOTE],
    );
  } catch (e) {
    // non-fatal: attendance is not critical path
    console.warn("sweepStaleAttendance failed", e?.message || e);
  }
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (xf || req.ip || req.socket?.remoteAddress || "").slice(0, 64) || null;
}

/**
 * Open (or return existing) attendance row for a staff user. Idempotent —
 * if the user already has an open row for today, that row is returned and
 * no new insert happens. Any dangling open row from a previous day is
 * auto-closed at the new check-in time.
 * @returns {Promise<{id:number, check_in_at:string, work_date:string, reused:boolean}>}
 */
export async function openAttendance({ userId, username, isSuper, req }) {
  // Super admins are not staff members — skip attendance tracking.
  if (isSuper) return null;
  const today = caDateStr();
  const ip = clientIp(req);

  // 0. Auto-close any row that's been open 8+ hours (across all users).
  await sweepStaleAttendance();

  // 1. Auto-close any dangling row from an earlier day.
  await pool.query(
    `UPDATE staff_attendance
        SET check_out_at = NOW(),
            source = 'auto',
            notes = CONCAT(COALESCE(notes,''), IF(notes IS NULL OR notes='','','; '), 'auto-closed on new check-in')
      WHERE user_id = ? AND check_out_at IS NULL AND work_date < ?`,
    [userId, today],
  );

  // 2. Reuse today's open row if it exists.
  const [existing] = await pool.query(
    `SELECT id, check_in_at, work_date FROM staff_attendance
      WHERE user_id = ? AND work_date = ? AND check_out_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [userId, today],
  );
  if (existing.length) {
    const r = existing[0];
    return { id: r.id, check_in_at: r.check_in_at, work_date: r.work_date, reused: true };
  }

  // 3. Insert a new open row.
  const [ins] = await pool.query(
    `INSERT INTO staff_attendance (user_id, username, check_in_at, check_in_ip, source, work_date)
     VALUES (?, ?, NOW(), ?, 'login_modal', ?)`,
    [userId, username, ip, today],
  );
  const [rows] = await pool.query(
    "SELECT check_in_at, work_date FROM staff_attendance WHERE id = ?",
    [ins.insertId],
  );
  const r = rows[0] || {};
  const result = { id: ins.insertId, check_in_at: r.check_in_at, work_date: r.work_date, reused: false };
  emitAttendanceEvent("check_in", { ...result, user_id: userId, username });
  return result;
}

/**
 * Close the user's most recent open row. No-op if there's nothing open.
 * @returns {Promise<{id:number, check_in_at:string, check_out_at:string}|null>}
 */
export async function closeAttendance({ userId, req }) {
  const ip = clientIp(req);
  const [open] = await pool.query(
    `SELECT id FROM staff_attendance
      WHERE user_id = ? AND check_out_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  if (!open.length) return null;
  const id = open[0].id;
  await pool.query(
    `UPDATE staff_attendance SET check_out_at = NOW(), check_out_ip = ? WHERE id = ?`,
    [ip, id],
  );
  const [rows] = await pool.query(
    "SELECT id, check_in_at, check_out_at FROM staff_attendance WHERE id = ?",
    [id],
  );
  const closed = rows[0] || null;
  if (closed) emitAttendanceEvent("check_out", { ...closed, user_id: userId });
  return closed;
}

// ---------------- Admin router ----------------
export const attendanceRouter = Router();

// GET /admin/attendance/users — dropdown source
attendanceRouter.get("/attendance/users", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, full_name, role, is_super
         FROM admin_users
        WHERE is_super = 0 AND role <> 'guest'
        ORDER BY full_name, username`,
    );
    res.json({ items: rows });
  } catch (e) { next(e); }
});

const listSchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});

attendanceRouter.get("/attendance", async (req, res, next) => {
  try {
    await sweepStaleAttendance();
    const p = listSchema.safeParse(req.query);
    if (!p.success) return res.status(400).json({ error: "Invalid filters" });
    const { user_id, from, to, limit } = p.data;
    const where = [];
    const params = [];
    if (user_id) { where.push("a.user_id = ?"); params.push(user_id); }
    if (from) { where.push("a.work_date >= ?"); params.push(from); }
    if (to) { where.push("a.work_date <= ?"); params.push(to); }
    const sql = `
      SELECT a.id, a.user_id, a.username, a.check_in_at, a.check_out_at,
             a.check_in_ip, a.check_out_ip, a.source, a.notes, a.work_date,
             u.full_name
        FROM staff_attendance a
        LEFT JOIN admin_users u ON u.id = a.user_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY a.check_in_at DESC
       LIMIT ?`;
    params.push(limit);
    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// Super-admin edit for corrections
const editSchema = z.object({
  check_in_at: z.string().optional(),
  check_out_at: z.string().nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
});

attendanceRouter.patch("/attendance/:id", async (req, res, next) => {
  try {
    if (!req.admin?.is_super) return res.status(403).json({ error: "Super Admin only" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
    const p = editSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const sets = [];
    const vals = [];
    if (p.data.check_in_at !== undefined) { sets.push("check_in_at = ?"); vals.push(p.data.check_in_at); }
    if (p.data.check_out_at !== undefined) { sets.push("check_out_at = ?"); vals.push(p.data.check_out_at); }
    if (p.data.notes !== undefined) { sets.push("notes = ?"); vals.push(p.data.notes); }
    if (!sets.length) return res.json({ ok: true });
    sets.push("source = 'manual'");
    vals.push(id);
    await pool.query(`UPDATE staff_attendance SET ${sets.join(", ")} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

attendanceRouter.delete("/attendance/:id", async (req, res, next) => {
  try {
    if (!req.admin?.is_super) return res.status(403).json({ error: "Super Admin only" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
    await pool.query("DELETE FROM staff_attendance WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------- External sync API ----------------
// Auth: shared secret in `Authorization: Bearer <key>` or `x-api-key` header.
// Key is read from site_settings.attendance_sync_api_key with fallback to env
// ATTENDANCE_SYNC_API_KEY. Webhook URL similarly from site_settings first.
async function readSetting(key) {
  try {
    const [rows] = await pool.query("SELECT v FROM site_settings WHERE k = ?", [key]);
    return rows[0]?.v || "";
  } catch { return ""; }
}
async function getSyncKey() {
  return (await readSetting("attendance_sync_api_key")) || process.env.ATTENDANCE_SYNC_API_KEY || "";
}
async function getWebhookUrl() {
  return (await readSetting("attendance_webhook_url")) || process.env.ATTENDANCE_WEBHOOK_URL || "";
}

async function requireSyncKey(req, res, next) {
  const expected = await getSyncKey();
  if (!expected) return res.status(503).json({ error: "Sync API not configured" });
  const hdr = String(req.headers.authorization || "");
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  const provided = bearer || String(req.headers["x-api-key"] || "");
  if (!provided || provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Super-admin: generate a fresh sync key, store it, and return it (once).
attendanceRouter.post("/attendance/sync-key/generate", async (req, res, next) => {
  try {
    if (!req.admin?.is_super) return res.status(403).json({ error: "Super Admin only" });
    const key = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
      ["attendance_sync_api_key", key],
    );
    res.json({ key });
  } catch (e) { next(e); }
});

export const attendanceSyncRouter = Router();

const syncSchema = z.object({
  since: z.string().datetime().optional(),      // ISO timestamp; returns rows updated after
  user_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});

// GET /api/attendance/sync?since=2025-07-23T10:00:00Z
// Returns rows changed since the given timestamp, ordered by updated_at ASC.
// Clients poll with the last `server_time` they received to get incremental updates.
attendanceSyncRouter.get("/attendance/sync", requireSyncKey, async (req, res, next) => {
  try {
    await sweepStaleAttendance();
    const p = syncSchema.safeParse(req.query);
    if (!p.success) return res.status(400).json({ error: "Invalid filters" });
    const { since, user_id, limit } = p.data;
    const where = [];
    const params = [];
    if (since) { where.push("a.updated_at > ?"); params.push(new Date(since)); }
    if (user_id) { where.push("a.user_id = ?"); params.push(user_id); }
    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.username, u.full_name,
              a.check_in_at, a.check_out_at, a.check_in_ip, a.check_out_ip,
              a.source, a.notes, a.work_date, a.updated_at
         FROM staff_attendance a
         LEFT JOIN admin_users u ON u.id = a.user_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY a.updated_at ASC
        LIMIT ?`,
      [...params, limit],
    );
    const [[{ now }]] = await pool.query("SELECT UTC_TIMESTAMP(3) AS now");
    res.json({
      items: rows,
      server_time: new Date(now).toISOString(),
      next_since: rows.length ? new Date(rows[rows.length - 1].updated_at).toISOString() : (since || null),
      has_more: rows.length === limit,
    });
  } catch (e) { next(e); }
});

// Optional outbound push: fire-and-forget POST to the webhook URL on every
// check-in / check-out. Signed with HMAC-SHA256 using the same sync key.
export async function emitAttendanceEvent(event, row) {
  try {
    const url = await getWebhookUrl();
    const key = await getSyncKey();
    if (!url || !row) return;
    const body = JSON.stringify({ event, row, sent_at: new Date().toISOString() });
    const headers = { "Content-Type": "application/json" };
    if (key) headers["X-Signature"] = crypto.createHmac("sha256", key).update(body).digest("hex");
    fetch(url, { method: "POST", headers, body }).catch((e) =>
      console.warn("attendance webhook failed:", e?.message || e),
    );
  } catch (e) {
    console.warn("emitAttendanceEvent failed:", e?.message || e);
  }
}

