import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { resolveImageUrl } from "../lib/uploads.js";

export const promotionsRouter = Router();
export const publicPromotionsRouter = Router();

async function loadSlides(promotionIds) {
  if (!promotionIds.length) return new Map();
  const [rows] = await pool.query(
    `SELECT id, promotion_id, image_url, sort_order
       FROM promotion_slides
      WHERE promotion_id IN (${promotionIds.map(() => "?").join(",")})
      ORDER BY sort_order ASC, id ASC`,
    promotionIds,
  );
  const map = new Map();
  for (const id of promotionIds) map.set(id, []);
  for (const r of rows) {
    map.get(r.promotion_id)?.push({
      id: r.id,
      imageUrl: resolveImageUrl(r.image_url),
      sortOrder: r.sort_order,
    });
  }
  return map;
}

function dateToYMD(v) {
  if (!v) return null;
  if (v instanceof Date) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(v);
    const g = (t) => p.find((x) => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}`;
  }
  return String(v).slice(0, 10);
}
function timeToHMS(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(11, 19);
  const s = String(v);
  return s.length === 5 ? `${s}:00` : s.slice(0, 8);
}

function shapePromotion(r, slides) {
  return {
    id: r.id,
    name: r.name,
    isActive: !!r.is_active,
    daysOfWeek: r.days_of_week
      ? String(r.days_of_week).split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
      : [],
    dateStart: dateToYMD(r.date_start),
    dateEnd: dateToYMD(r.date_end),
    timeStart: timeToHMS(r.time_start),
    timeEnd: timeToHMS(r.time_end),
    slideDurationMs: Number(r.slide_duration_ms) || 5000,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    slides,
  };
}

// ---------- Public ----------
publicPromotionsRouter.get("/promotions/active", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM promotions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`,
    );
    // Evaluate schedule in Canadian timezone (America/Toronto)
    const TZ = "America/Toronto";
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, weekday: "short",
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const todayStr = `${get("year")}-${get("month")}-${get("day")}`;
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[get("weekday")] ?? now.getDay();
    let hh = get("hour"); if (hh === "24") hh = "00";
    const hhmm = `${hh}:${get("minute")}:${get("second")}`;

    const toYMD = (v) => {
      if (!v) return null;
      if (v instanceof Date) {
        // Format in CA timezone to avoid UTC off-by-one
        const p = new Intl.DateTimeFormat("en-CA", {
          timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(v);
        const g = (t) => p.find((x) => x.type === t)?.value || "";
        return `${g("year")}-${g("month")}-${g("day")}`;
      }
      return String(v).slice(0, 10);
    };
    const toHMS = (v) => {
      if (!v) return null;
      if (v instanceof Date) {
        const s = v.toISOString().slice(11, 19);
        return s;
      }
      const s = String(v);
      return s.length === 5 ? `${s}:00` : s.slice(0, 8);
    };

    const eligible = rows.filter((r) => {
      const ds = toYMD(r.date_start);
      const de = toYMD(r.date_end);
      if (ds && todayStr < ds) return false;
      if (de && todayStr > de) return false;
      if (r.days_of_week) {
        const days = String(r.days_of_week).split(",").map((s) => Number(s.trim()));
        if (days.length && !days.includes(dow)) return false;
      }
      const ts = toHMS(r.time_start);
      const te = toHMS(r.time_end);
      if (ts && hhmm < ts) return false;
      if (te && hhmm > te) return false;
      return true;
    });
    const slidesMap = await loadSlides(eligible.map((r) => r.id));
    const items = eligible
      .map((r) => shapePromotion(r, slidesMap.get(r.id) || []))
      .filter((p) => p.slides.length > 0);
    res.json({ items });
  } catch (e) { next(e); }
});

// ---------- Admin ----------
const slideSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  sortOrder: z.number().int().optional().default(0),
});
const promoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional().default(true),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
  timeStart: z.string().nullable().optional(),
  timeEnd: z.string().nullable().optional(),
  slideDurationMs: z.number().int().min(500).max(120000).optional().default(5000),
  sortOrder: z.number().int().optional().default(0),
  slides: z.array(slideSchema).default([]),
});

promotionsRouter.get("/promotions", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM promotions ORDER BY sort_order ASC, id ASC`);
    const slidesMap = await loadSlides(rows.map((r) => r.id));
    res.json({ items: rows.map((r) => shapePromotion(r, slidesMap.get(r.id) || [])) });
  } catch (e) { next(e); }
});

async function replaceSlides(conn, promotionId, slides) {
  await conn.query("DELETE FROM promotion_slides WHERE promotion_id = ?", [promotionId]);
  if (!slides.length) return;
  const values = slides.map((s, i) => [promotionId, s.imageUrl, s.sortOrder ?? i]);
  await conn.query(
    "INSERT INTO promotion_slides (promotion_id, image_url, sort_order) VALUES ?",
    [values],
  );
}

function toDateOrNull(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}
function toTimeOrNull(v) {
  if (!v) return null;
  const s = String(v);
  return s.length === 5 ? `${s}:00` : s.slice(0, 8);
}

promotionsRouter.post("/promotions", async (req, res, next) => {
  const p = promoSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const d = p.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO promotions (name, is_active, days_of_week, date_start, date_end, time_start, time_end, slide_duration_ms, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        d.name, d.isActive ? 1 : 0,
        d.daysOfWeek.length ? d.daysOfWeek.join(",") : null,
        toDateOrNull(d.dateStart), toDateOrNull(d.dateEnd),
        toTimeOrNull(d.timeStart), toTimeOrNull(d.timeEnd),
        d.slideDurationMs, d.sortOrder,
      ],
    );
    await replaceSlides(conn, r.insertId, d.slides);
    await conn.commit();
    res.status(201).json({ id: r.insertId });
  } catch (e) { await conn.rollback(); next(e); }
  finally { conn.release(); }
});

promotionsRouter.patch("/promotions/:id", async (req, res, next) => {
  const p = promoSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const id = Number(req.params.id);
  const d = p.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const fields = {};
    if (d.name !== undefined) fields.name = d.name;
    if (d.isActive !== undefined) fields.is_active = d.isActive ? 1 : 0;
    if (d.daysOfWeek !== undefined) fields.days_of_week = d.daysOfWeek.length ? d.daysOfWeek.join(",") : null;
    if (d.dateStart !== undefined) fields.date_start = toDateOrNull(d.dateStart);
    if (d.dateEnd !== undefined) fields.date_end = toDateOrNull(d.dateEnd);
    if (d.timeStart !== undefined) fields.time_start = toTimeOrNull(d.timeStart);
    if (d.timeEnd !== undefined) fields.time_end = toTimeOrNull(d.timeEnd);
    if (d.slideDurationMs !== undefined) fields.slide_duration_ms = d.slideDurationMs;
    if (d.sortOrder !== undefined) fields.sort_order = d.sortOrder;
    const entries = Object.entries(fields);
    if (entries.length) {
      await conn.query(
        `UPDATE promotions SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
        [...entries.map(([, v]) => v), id],
      );
    }
    if (d.slides !== undefined) await replaceSlides(conn, id, d.slides);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) { await conn.rollback(); next(e); }
  finally { conn.release(); }
});

promotionsRouter.delete("/promotions/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM promotions WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
