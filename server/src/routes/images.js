/**
 * Admin image-management endpoints (Media library).
 * Mounted under /admin (and /api/admin); requireAdmin applied upstream.
 */
import { Router } from "express";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { pool } from "../db.js";
import {
  listUploadedImages,
  convertFileToAvif,
  isOptimizedFilename,
  publicUrlFor,
  dirFor,
  publicBaseFor,
  normalizeFolder,
  folderFromUrl,
  invalidateImageUrlCache,
} from "../lib/uploads.js";

export const imagesRouter = Router();
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".tif", ".tiff"]);

async function getSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.warn("[images] sharp is not installed; image processing is unavailable.");
      return null;
    }
    throw err;
  }
}

function altKey(filename, folder) { return `${normalizeFolder(folder)}:${filename}`; }
async function getAltMap(items) {
  if (!items.length) return new Map();
  const map = new Map();
  try {
    const keys = items.map((i) => altKey(i.filename, i.folder));
    const placeholders = keys.map(() => "?").join(",");
    const [rows] = await pool.query(`SELECT filename, alt FROM image_meta WHERE filename IN (${placeholders})`, keys);
    for (const r of rows) map.set(r.filename, r.alt || "");
  } catch { /* ignore */ }
  return map;
}
async function getAlt(filename, folder) {
  try { const [rows] = await pool.query(`SELECT alt FROM image_meta WHERE filename = ?`, [altKey(filename, folder)]); return rows[0]?.alt || ""; }
  catch { return ""; }
}
async function setAlt(filename, folder, alt) {
  const value = String(alt || "").slice(0, 500);
  try {
    await pool.query(
      `INSERT INTO image_meta (filename, alt) VALUES (?, ?) ON DUPLICATE KEY UPDATE alt = VALUES(alt)`,
      [altKey(filename, folder), value],
    );
  } catch { /* ignore */ }
}
async function moveAlt(oldName, oldFolder, newName, newFolder) {
  if (oldName === newName && normalizeFolder(oldFolder) === normalizeFolder(newFolder)) return;
  const alt = await getAlt(oldName, oldFolder);
  if (alt) await setAlt(newName, newFolder, alt);
  try { await pool.query(`DELETE FROM image_meta WHERE filename = ?`, [altKey(oldName, oldFolder)]); } catch { /* ignore */ }
}

const SETTINGS_KEY_LABELS = {
  logo_url: "Site logo",
  favicon_url: "Favicon",
  hero_url: "Home hero",
};

// Candidate URLs for `filename`: the actual URL, plus the same basename with
// every other known image extension. After Media → Optimize, a row in the DB
// may still reference foo.jpg even though the file on disk is now foo.avif
// (image-fallback middleware serves it). We want both to count as "used".
const EXT_VARIANTS = [".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif"];
function urlVariants(filename, folder) {
  const ext = path.extname(filename).toLowerCase();
  const base = filename.slice(0, filename.length - ext.length);
  const names = EXT_VARIANTS.includes(ext)
    ? Array.from(new Set([filename, ...EXT_VARIANTS.map((e) => base + e)]))
    : [filename];
  return names.map((n) => publicUrlFor(n, folder));
}

async function findUsage(filename, folder) {
  const urls = urlVariants(filename, folder);
  const eqClause = urls.map(() => "?").join(",");
  const likeClause = urls.map(() => "?? LIKE ?".replace("??", "")).map(() => "v LIKE ?").join(" OR ");
  const likeParams = urls.map((u) => `%${u}%`);
  const usage = [];
  const queries = [
    [`SELECT id, name, slug FROM products WHERE image_url IN (${eqClause})`, urls,
      (r) => ({ type: "product", label: `Product: ${r.name}`, page: `/product/${r.slug}` })],
    [`SELECT id, name, slug FROM products WHERE ${urls.map(() => "long_description LIKE ?").join(" OR ")}`, likeParams,
      (r) => ({ type: "product", label: `Product (description): ${r.name}`, page: `/product/${r.slug}` })],
    [`SELECT id, name, slug FROM categories WHERE image_url IN (${eqClause})`, urls,
      (r) => ({ type: "category", label: `Category: ${r.name}`, page: `/category/${r.slug}` })],
    [`SELECT k, v FROM site_settings WHERE v IN (${eqClause}) OR ${likeClause}`, [...urls, ...likeParams],
      (r) => ({ type: "setting", label: SETTINGS_KEY_LABELS[r.k] || `Setting: ${r.k}`, page: null })],
    [`SELECT slot_key, image_url FROM page_images WHERE image_url IN (${eqClause})`, urls,
      (r) => ({ type: "page", label: `Page image: ${r.slot_key}`, page: null })],
    [`SELECT ps.id, ps.promotion_id, p.name FROM promotion_slides ps LEFT JOIN promotions p ON p.id = ps.promotion_id WHERE ps.image_url IN (${eqClause})`, urls,
      (r) => ({ type: "promotion", label: `Promotion slide: ${r.name || r.promotion_id}`, page: "/promotions" })],
  ];
  for (const [sql, params, mapper] of queries) {
    try {
      const [rows] = await pool.query(sql, params);
      for (const r of rows) usage.push(mapper(r));
    } catch { /* ignore */ }
  }
  return usage;
}

async function rewriteUrlEverywhere(oldUrl, newUrl) {
  if (oldUrl === newUrl) return;
  const stmts = [
    ["UPDATE products       SET image_url = ? WHERE image_url = ?", [newUrl, oldUrl]],
    ["UPDATE products       SET long_description = REPLACE(long_description, ?, ?) WHERE long_description LIKE ?", [oldUrl, newUrl, `%${oldUrl}%`]],
    ["UPDATE categories     SET image_url = ? WHERE image_url = ?", [newUrl, oldUrl]],
    ["UPDATE site_settings  SET v = ? WHERE v = ?", [newUrl, oldUrl]],
    ["UPDATE site_settings  SET v = REPLACE(v, ?, ?) WHERE v LIKE ?", [oldUrl, newUrl, `%${oldUrl}%`]],
    ["UPDATE page_images    SET image_url = ? WHERE image_url = ?", [newUrl, oldUrl]],
    ["UPDATE promotion_slides SET image_url = ? WHERE image_url = ?", [newUrl, oldUrl]],
  ];
  for (const [sql, params] of stmts) {
    try { await pool.query(sql, params); } catch { /* ignore */ }
  }
}

async function optimizeOne(filename, folder) {
  if (isOptimizedFilename(filename)) return { filename, folder, changed: false, optimized: true };
  const safe = path.basename(filename);
  const newName = await convertFileToAvif(safe, folder);
  if (newName === safe) return { filename: safe, folder, changed: false, optimized: isOptimizedFilename(safe) };
  await rewriteUrlEverywhere(publicUrlFor(safe, folder), publicUrlFor(newName, folder));
  await moveAlt(safe, folder, newName, folder);
  await fs.unlink(path.join(dirFor(folder), safe)).catch(() => {});
  invalidateImageUrlCache();
  return { filename: newName, oldFilename: safe, folder, changed: true, optimized: true };
}

function safeImageName(filename) {
  const safe = path.basename(String(filename || "").trim());
  if (!safe || !IMAGE_EXTS.has(path.extname(safe).toLowerCase())) return null;
  return safe;
}
function pickFolder(req) {
  return normalizeFolder(req.query?.folder ?? req.body?.folder ?? "page");
}
async function fileHash(filename, folder) {
  const data = await fs.readFile(path.join(dirFor(folder), filename));
  return crypto.createHash("sha256").update(data).digest("hex");
}

imagesRouter.get("/images", async (req, res, next) => {
  try {
    const requested = req.query?.folder;
    const folders = requested ? [normalizeFolder(requested)] : ["page", "products"];
    const all = [];
    for (const f of folders) all.push(...(await listUploadedImages(f)));
    const altMap = await getAltMap(all);
    const enriched = await Promise.all(all.map(async (i) => {
      const usage = await findUsage(i.filename, i.folder);
      return { ...i, alt: altMap.get(altKey(i.filename, i.folder)) || "", usedCount: usage.length, usages: usage };
    }));
    res.json({ items: enriched });
  } catch (err) { next(err); }
});

imagesRouter.get("/images/usage", async (req, res, next) => {
  try {
    const filename = safeImageName(req.query?.filename);
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const folder = pickFolder(req);
    res.json({ filename, folder, usages: await findUsage(filename, folder) });
  } catch (err) { next(err); }
});

imagesRouter.get("/images/alt", async (req, res, next) => {
  try {
    const filename = safeImageName(req.query?.filename);
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const folder = pickFolder(req);
    res.json({ filename, folder, alt: await getAlt(filename, folder) });
  } catch (err) { next(err); }
});

imagesRouter.put("/images/alt", async (req, res, next) => {
  try {
    const filename = safeImageName(req.body?.filename);
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const folder = pickFolder(req);
    await setAlt(filename, folder, req.body?.alt);
    res.json({ ok: true, filename, folder, alt: String(req.body?.alt || "").slice(0, 500) });
  } catch (err) { next(err); }
});

imagesRouter.delete("/images/:filename", async (req, res, next) => {
  try {
    const filename = safeImageName(req.params?.filename);
    if (!filename) return res.status(400).json({ error: "Invalid filename" });
    const folder = pickFolder(req);
    const usage = await findUsage(filename, folder);
    if (usage.length > 0) return res.status(409).json({ error: "Image is in use and cannot be deleted.", usages: usage });
    await fs.unlink(path.join(dirFor(folder), filename)).catch(() => {});
    try { await pool.query(`DELETE FROM image_meta WHERE filename = ?`, [altKey(filename, folder)]); } catch { /* ignore */ }
    res.json({ ok: true, filename, folder });
  } catch (err) { next(err); }
});

imagesRouter.post("/images/optimize", async (req, res, next) => {
  try {
    const filename = String(req.body?.filename || "").trim();
    if (!filename) return res.status(400).json({ error: "filename is required" });
    res.json(await optimizeOne(filename, pickFolder(req)));
  } catch (err) { next(err); }
});

imagesRouter.post("/images/optimize-all", async (req, res, next) => {
  try {
    const folders = req.body?.folder ? [normalizeFolder(req.body.folder)] : ["page", "products"];
    const all = [];
    for (const f of folders) all.push(...(await listUploadedImages(f)));
    const pending = all.filter((i) => !i.optimized);
    const results = [];
    let failed = 0;
    for (const item of pending) {
      try { results.push(await optimizeOne(item.filename, item.folder)); }
      catch (e) { failed += 1; results.push({ filename: item.filename, folder: item.folder, error: e.message || String(e) }); }
    }
    res.json({ total: pending.length, optimized: results.filter((r) => r.changed).length, failed, results });
  } catch (err) { next(err); }
});

imagesRouter.post("/images/duplicates/scan", async (req, res, next) => {
  try {
    const folders = req.body?.folder ? [normalizeFolder(req.body.folder)] : ["page", "products"];
    const all = [];
    for (const f of folders) all.push(...(await listUploadedImages(f)));
    const byHash = new Map();
    for (const item of all) {
      try {
        const hash = await fileHash(item.filename, item.folder);
        const list = byHash.get(hash) || [];
        list.push(item);
        byHash.set(hash, list);
      } catch { /* ignore */ }
    }
    const removed = [];
    for (const group of byHash.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => (b.optimized ? 1 : 0) - (a.optimized ? 1 : 0) || a.mtime - b.mtime);
      const keep = group[0];
      for (const dup of group.slice(1)) {
        if (dup.folder !== keep.folder) continue;
        await rewriteUrlEverywhere(dup.url, keep.url);
        await moveAlt(dup.filename, dup.folder, keep.filename, keep.folder);
        await fs.unlink(path.join(dirFor(dup.folder), dup.filename)).catch(() => {});
        removed.push({ deleted: dup.filename, kept: keep.filename, folder: keep.folder });
      }
    }
    res.json({ scanned: all.length, removed: removed.length, items: removed });
  } catch (err) { next(err); }
});

imagesRouter.post("/images/replace", async (req, res, next) => {
  try {
    const oldName = safeImageName(req.body?.filename);
    const folder = pickFolder(req);
    const newUrl = String(req.body?.newUrl || "").trim();
    const base = publicBaseFor(folder);
    if (!oldName || !newUrl.startsWith(base + "/")) return res.status(400).json({ error: "Valid filename and replacement URL are required" });
    const newName = safeImageName(path.basename(newUrl));
    if (!newName) return res.status(400).json({ error: "Replacement must be an uploaded image" });
    await rewriteUrlEverywhere(publicUrlFor(oldName, folder), publicUrlFor(newName, folder));
    await moveAlt(oldName, folder, newName, folder);
    if (oldName !== newName) await fs.unlink(path.join(dirFor(folder), oldName)).catch(() => {});
    res.json({ ok: true, filename: newName, folder, url: publicUrlFor(newName, folder) });
  } catch (err) { next(err); }
});

imagesRouter.post("/images/rename", async (req, res, next) => {
  try {
    const oldName = safeImageName(req.body?.filename);
    if (!oldName) return res.status(400).json({ error: "Valid filename is required" });
    const folder = pickFolder(req);
    const dir = dirFor(folder);
    const rawNew = String(req.body?.newName || "").trim();
    if (!rawNew) return res.status(400).json({ error: "New name is required" });
    const oldExt = path.extname(oldName);
    const baseInput = path.basename(rawNew).replace(/\.[a-z0-9]+$/i, "");
    const sanitized = baseInput.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!sanitized) return res.status(400).json({ error: "Name contains no valid characters" });
    let newName = `${sanitized}${oldExt}`;
    if (newName === oldName) return res.json({ ok: true, filename: oldName, folder, url: publicUrlFor(oldName, folder) });
    try {
      await fs.access(path.join(dir, newName));
      const suffix = crypto.randomBytes(3).toString("hex");
      newName = `${sanitized}-${suffix}${oldExt}`;
    } catch { /* free */ }
    await fs.rename(path.join(dir, oldName), path.join(dir, newName));
    await rewriteUrlEverywhere(publicUrlFor(oldName, folder), publicUrlFor(newName, folder));
    await moveAlt(oldName, folder, newName, folder);
    res.json({ ok: true, filename: newName, folder, url: publicUrlFor(newName, folder) });
  } catch (err) { next(err); }
});

imagesRouter.post("/images/edit", async (req, res, next) => {
  try {
    const filename = safeImageName(req.body?.filename);
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const folder = pickFolder(req);
    const dir = dirFor(folder);
    const crop = req.body?.crop || null;
    const width = Number(req.body?.width || 0);
    const src = path.join(dir, filename);
    const sharp = await getSharp();
    if (!sharp) return res.status(503).json({ error: "Image editor requires the sharp package. Run npm install on the server, then restart the Node app." });
    let img = sharp(src);
    if (crop) {
      const left = Math.max(0, Math.round(Number(crop.x || 0)));
      const top = Math.max(0, Math.round(Number(crop.y || 0)));
      const cWidth = Math.max(1, Math.round(Number(crop.width || 0)));
      const cHeight = Math.max(1, Math.round(Number(crop.height || 0)));
      img = img.extract({ left, top, width: cWidth, height: cHeight });
    }
    if (width > 0) img = img.resize({ width: Math.round(width), withoutEnlargement: true });
    const base = path.basename(filename, path.extname(filename));
    const newName = `${base}-edit-${Date.now().toString(36)}.avif`;
    await img.avif({ quality: 60, effort: 4 }).toFile(path.join(dir, newName));
    await rewriteUrlEverywhere(publicUrlFor(filename, folder), publicUrlFor(newName, folder));
    await moveAlt(filename, folder, newName, folder);
    await fs.unlink(src).catch(() => {});
    res.json({ ok: true, filename: newName, folder, url: publicUrlFor(newName, folder) });
  } catch (err) { next(err); }
});

export { folderFromUrl };
