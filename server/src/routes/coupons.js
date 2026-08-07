import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const couponsRouter = Router();

/** Compute discount for a coupon against a subtotal. Returns { discount, freeItem|null, error|null } */
export async function evaluateCoupon(coupon, subtotal, opts = {}) {
  if (!coupon) return { error: "Coupon not found" };
  if (!coupon.is_active) return { error: "Coupon is inactive" };
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { error: "Coupon not yet active" };
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { error: "Coupon has expired" };
  if (coupon.usage_limit != null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return { error: "Coupon usage limit reached" };
  }
  if (Number(coupon.min_subtotal || 0) > subtotal) {
    return { error: `Order must be at least $${Number(coupon.min_subtotal).toFixed(2)}` };
  }
  if (coupon.per_customer_limit != null && opts.customerPhone) {
    const [[row]] = await pool.query(
      "SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND customer_phone = ?",
      [coupon.id, String(opts.customerPhone).trim()],
    );
    if (Number(row.n) >= Number(coupon.per_customer_limit)) {
      return { error: "You have already used this coupon the maximum number of times" };
    }
  }

  if (coupon.type === "percent") {
    let d = subtotal * (Number(coupon.value) / 100);
    if (coupon.max_discount) d = Math.min(d, Number(coupon.max_discount));
    d = Math.min(Math.round(d * 100) / 100, subtotal);
    return { discount: d, freeItem: null, error: null };
  }
  if (coupon.type === "fixed") {
    const d = Math.min(Number(coupon.value), subtotal);
    return { discount: Math.round(d * 100) / 100, freeItem: null, error: null };
  }
  if (coupon.type === "free_item") {
    if (!coupon.free_product_id) return { error: "Coupon misconfigured (no free item)" };
    const [rows] = await pool.query(
      "SELECT id, slug, name, price FROM products WHERE id = ? AND is_active = 1 LIMIT 1",
      [coupon.free_product_id],
    );
    if (!rows.length) return { error: "Free item unavailable" };
    const p = rows[0];
    return {
      discount: 0,
      freeItem: { id: p.id, slug: p.slug, name: p.name, value: Number(p.price) },
      error: null,
    };
  }
  return { error: "Unknown coupon type" };
}

export async function getCouponByCode(code) {
  if (!code) return null;
  const [rows] = await pool.query(
    "SELECT * FROM coupons WHERE code = ? LIMIT 1",
    [String(code).trim().toUpperCase()],
  );
  return rows[0] || null;
}

/** Public: validate a coupon for a given subtotal (read-only) */
export const publicCouponsRouter = Router();
publicCouponsRouter.post("/coupons/apply", async (req, res) => {
  const schema = z.object({
    code: z.string().trim().min(1).max(40),
    subtotal: z.number().nonnegative(),
    customerPhone: z.string().trim().max(40).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const coupon = await getCouponByCode(parsed.data.code);
  const result = await evaluateCoupon(coupon, parsed.data.subtotal, { customerPhone: parsed.data.customerPhone });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({
    ok: true,
    code: coupon.code,
    type: coupon.type,
    description: coupon.description,
    discount: result.discount,
    freeItem: result.freeItem,
  });
});

// ---------- Admin CRUD ----------
const couponSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, _ and - only"),
  description: z.string().max(255).optional().default(""),
  type: z.enum(["percent", "fixed", "free_item"]),
  value: z.number().nonnegative().max(99999),
  max_discount: z.number().nonnegative().nullable().optional(),
  min_subtotal: z.number().nonnegative().optional().default(0),
  free_product_id: z.number().int().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  usage_limit: z.number().int().nonnegative().nullable().optional(),
  per_customer_limit: z.number().int().nonnegative().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

couponsRouter.get("/coupons", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, p.name AS free_product_name, p.slug AS free_product_slug
         FROM coupons c LEFT JOIN products p ON p.id = c.free_product_id
         ORDER BY c.created_at DESC`,
    );
    res.json({ items: rows.map((r) => ({ ...r, is_active: !!r.is_active })) });
  } catch (e) { next(e); }
});

couponsRouter.post("/coupons", async (req, res, next) => {
  try {
    const p = couponSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const d = p.data;
    const [r] = await pool.query(
      `INSERT INTO coupons (code, description, type, value, max_discount, min_subtotal, free_product_id,
        starts_at, expires_at, usage_limit, per_customer_limit, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.code.toUpperCase(), d.description || "", d.type, d.value,
        d.max_discount ?? null, d.min_subtotal ?? 0, d.free_product_id ?? null,
        d.starts_at || null, d.expires_at || null,
        d.usage_limit ?? null, d.per_customer_limit ?? null,
        d.is_active ? 1 : 0,
      ],
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Coupon code already exists" });
    next(e);
  }
});

couponsRouter.patch("/coupons/:id", async (req, res, next) => {
  try {
    const p = couponSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const data = { ...p.data };
    if (data.code) data.code = data.code.toUpperCase();
    if (typeof data.is_active === "boolean") data.is_active = data.is_active ? 1 : 0;
    const entries = Object.entries(data);
    if (!entries.length) return res.json({ ok: true });
    await pool.query(
      `UPDATE coupons SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), req.params.id],
    );
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Coupon code already exists" });
    next(e);
  }
});

couponsRouter.delete("/coupons/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM coupons WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
