import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";
import { UPLOADS_DIR, PRODUCTS_DIR } from "../lib/uploads.js";

export const publicPageImagesRouter = Router();
export const adminPageImagesRouter = Router();

// Mirror of imageFallback logic: given a URL like /uploads/foo.jpg, return the
// actually-existing sibling (foo.avif/.webp/...) so admin previews always show
// the real current file, even after Media → Optimize converted formats.
const TRY_ORDER = [".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif"];
async function resolveExistingUrl(url) {
  if (typeof url !== "string" || !url) return url;
  const m = url.match(/^\/(uploads|products)\/(.+)$/);
  if (!m) return url;
  const dir = m[1] === "products" ? PRODUCTS_DIR : UPLOADS_DIR;
  const rel = decodeURIComponent(m[2].split("?")[0]);
  const ext = path.extname(rel).toLowerCase();
  const full = path.join(dir, rel);
  try { await fs.access(full); return url; } catch { /* missing */ }
  const baseNoExt = rel.slice(0, -ext.length);
  for (const alt of TRY_ORDER) {
    if (alt === ext) continue;
    try {
      await fs.access(path.join(dir, baseNoExt + alt));
      return `/${m[1]}/${baseNoExt + alt}`;
    } catch { /* try next */ }
  }
  return url;
}

// Public: return all overrides as { slot_key: image_url }
publicPageImagesRouter.get("/page-images", async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT slot_key, image_url FROM page_images`);
    const map = {};
    for (const r of rows) map[r.slot_key] = r.image_url;
    res.json(map);
  } catch {
    res.json({});
  }
});

// Admin: same map, plus per-row update/delete.
adminPageImagesRouter.get("/page-images", async (_req, res) => {
  const [rows] = await pool.query(`SELECT slot_key, image_url, updated_at FROM page_images`);
  const map = {};
  for (const r of rows) map[r.slot_key] = r.image_url;
  res.json(map);
});

adminPageImagesRouter.put("/page-images/:key", async (req, res) => {
  const schema = z.object({ url: z.string().trim().min(1).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const key = String(req.params.key || "").trim();
  if (!key || key.length > 120) return res.status(400).json({ error: "Invalid key" });
  await pool.query(
    `INSERT INTO page_images (slot_key, image_url) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
    [key, parsed.data.url],
  );
  res.json({ ok: true });
});

adminPageImagesRouter.delete("/page-images/:key", async (req, res) => {
  const key = String(req.params.key || "").trim();
  await pool.query(`DELETE FROM page_images WHERE slot_key = ?`, [key]);
  res.json({ ok: true });
});

// Resolve a list of URLs to the file that actually exists on disk right now.
// Used by the admin Page Images screen so previews reflect post-optimize state.
adminPageImagesRouter.post("/page-images/resolve", async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const out = {};
  await Promise.all(urls.map(async (u) => { out[u] = await resolveExistingUrl(u); }));
  res.json(out);
});
