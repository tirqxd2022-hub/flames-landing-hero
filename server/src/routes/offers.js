import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { evaluateCart, loadActiveOffers, safeJSON } from "../lib/offers-engine.js";

// ---------- Shared helpers ----------
function rowToOffer(r) {
  return {
    ...r,
    is_active: !!r.is_active,
    stackable: !!r.stackable,
    config: safeJSON(r.config) || {},
  };
}

// Build evaluator context from a cart payload that uses product slugs.
async function buildContext({ items, diningOption }) {
  const slugs = Array.from(new Set((items || []).map((i) => String(i.slug || "")).filter(Boolean)));
  let infoBySlug = new Map();
  if (slugs.length) {
    const [rows] = await pool.query(
      `SELECT p.id, p.slug, p.name, p.price, c.slug AS categorySlug, s.slug AS subcategorySlug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN subcategories s ON s.id = p.subcategory_id
        WHERE p.slug IN (${slugs.map(() => "?").join(",")})`,
      slugs,
    ).catch(async () => {
      // subcategory_id may not exist in older schemas — fall back without it.
      const [rows2] = await pool.query(
        `SELECT p.id, p.slug, p.name, p.price, c.slug AS categorySlug
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.slug IN (${slugs.map(() => "?").join(",")})`,
        slugs,
      );
      return [rows2];
    });
    for (const r of rows) infoBySlug.set(r.slug, r);
  }
  const ctxItems = (items || []).map((i) => {
    const info = infoBySlug.get(String(i.slug)) || {};
    return {
      productId: info.id ?? null,
      slug: String(i.slug || ""),
      name: i.name || info.name || "",
      categorySlug: info.categorySlug || i.categorySlug || null,
      subcategorySlug: info.subcategorySlug || i.subcategorySlug || null,
      variantId: i.variantId ?? null,
      unitPrice: Number(i.unitPrice ?? info.price ?? 0),
      qty: Math.max(0, Number(i.qty || 0)),
    };
  }).filter((l) => l.qty > 0);
  const subtotal = ctxItems.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { items: ctxItems, subtotal: Math.round(subtotal * 100) / 100, diningOption: diningOption || "any" };
}

// ============ PUBLIC ============
export const publicOffersRouter = Router();

publicOffersRouter.get("/offers/active", async (_req, res, next) => {
  try {
    const items = await loadActiveOffers();
    // Date range overrides all other scheduling: if today is outside
    // [starts_at, expires_at], the offer is hidden regardless of the
    // day-of-week / time-of-day settings below.
    const now = new Date();
    const live = items.filter((o) => {
      if (o.starts_at && new Date(o.starts_at) > now) return false;
      if (o.expires_at && new Date(o.expires_at) < now) return false;
      return true;
    });
    res.json({
      items: live.map((o) => ({
        id: o.id,
        slug: o.slug,
        type: o.type,
        name: o.name,
        description: o.description,
        image_url: o.image_url,
        config: o.config,
        starts_at: o.starts_at,
        expires_at: o.expires_at,
        days_of_week: o.days_of_week,
        time_from: o.time_from,
        time_to: o.time_to,
        dining_option: o.dining_option,
      })),
    });
  } catch (e) { next(e); }
});

publicOffersRouter.post("/offers/evaluate", async (req, res, next) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        slug: z.string(),
        name: z.string().optional(),
        unitPrice: z.number().nonnegative().optional(),
        qty: z.number().int().positive(),
        variantId: z.union([z.number(), z.null()]).optional(),
      })).default([]),
      diningOption: z.string().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const ctx = await buildContext(p.data);
    const result = await evaluateCart(ctx);
    res.json(result);
  } catch (e) { next(e); }
});

// ============ ADMIN ============
export const offersRouter = Router();

const configSchema = z.record(z.any()).default({});
const offerSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Letters, numbers, -"),
  type: z.enum(["cart_percent", "cart_amount", "bogo", "buy_x_get_y"]),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(500).optional().default(""),
  image_url: z.string().max(500).optional().default(""),
  config: configSchema,
  is_active: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
  stackable: z.boolean().optional().default(false),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  days_of_week: z.number().int().min(0).max(127).optional().default(127),
  time_from: z.string().nullable().optional(),
  time_to: z.string().nullable().optional(),
  dining_option: z.enum(["any", "dine_in", "takeout", "delivery"]).optional().default("any"),
  max_uses_per_order: z.number().int().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional().default(0),
});

offersRouter.get("/offers", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM offers ORDER BY priority DESC, sort_order ASC, id ASC");
    res.json({ items: rows.map(rowToOffer) });
  } catch (e) { next(e); }
});

offersRouter.post("/offers", async (req, res, next) => {
  try {
    const p = offerSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const d = p.data;
    const [r] = await pool.query(
      `INSERT INTO offers (slug, type, name, description, image_url, config, is_active, priority, stackable,
         starts_at, expires_at, days_of_week, time_from, time_to, dining_option, max_uses_per_order, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.slug, d.type, d.name, d.description || "", d.image_url || "",
        JSON.stringify(d.config || {}),
        d.is_active ? 1 : 0, d.priority || 0, d.stackable ? 1 : 0,
        d.starts_at || null, d.expires_at || null,
        d.days_of_week ?? 127, d.time_from || null, d.time_to || null,
        d.dining_option || "any", d.max_uses_per_order ?? null, d.sort_order || 0,
      ],
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Offer slug already exists" });
    next(e);
  }
});

offersRouter.patch("/offers/:id", async (req, res, next) => {
  try {
    const p = offerSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const data = { ...p.data };
    if ("config" in data && data.config) data.config = JSON.stringify(data.config);
    if (typeof data.is_active === "boolean") data.is_active = data.is_active ? 1 : 0;
    if (typeof data.stackable === "boolean") data.stackable = data.stackable ? 1 : 0;
    const entries = Object.entries(data);
    if (!entries.length) return res.json({ ok: true });
    await pool.query(
      `UPDATE offers SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), req.params.id],
    );
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Offer slug already exists" });
    next(e);
  }
});

offersRouter.delete("/offers/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM offers WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
