/**
 * Public on-the-fly image resizer.
 * GET /img?src=/uploads/foo.jpg&w=400[&h=300][&fit=cover]
 *
 * Only resizes images from UPLOADS_DIR / PRODUCTS_DIR (no SSRF).
 * Result is cached on disk under <UPLOADS_DIR>/_cache/ for fast re-serves.
 * Originals are never modified.
 */
import { Router } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  UPLOADS_DIR,
  PRODUCTS_DIR,
  UPLOADS_PUBLIC_BASE,
  PRODUCTS_PUBLIC_BASE,
  resolveImageUrl,
} from "../lib/uploads.js";
import { cacheControlHeader } from "../lib/cache-settings.js";

export const imgRouter = Router();

const CACHE_DIR = path.join(UPLOADS_DIR, "_cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

async function getSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.warn("[/img] sharp is not installed; serving original image.");
      return null;
    }
    throw err;
  }
}

const MIME = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

function srcToDiskPath(src) {
  const resolved = resolveImageUrl(src);
  // Strip optional /api prefix and query
  const cleaned = String(resolved).replace(/^\/api/, "").split("?")[0];
  if (cleaned.startsWith(UPLOADS_PUBLIC_BASE + "/")) {
    const rel = cleaned.slice(UPLOADS_PUBLIC_BASE.length + 1);
    const abs = path.join(UPLOADS_DIR, rel);
    if (abs.startsWith(UPLOADS_DIR)) return abs;
  }
  if (cleaned.startsWith(PRODUCTS_PUBLIC_BASE + "/")) {
    const rel = cleaned.slice(PRODUCTS_PUBLIC_BASE.length + 1);
    const abs = path.join(PRODUCTS_DIR, rel);
    if (abs.startsWith(PRODUCTS_DIR)) return abs;
  }
  return null;
}

imgRouter.get("/img", async (req, res) => {
  try {
    const src = String(req.query.src || "");
    const w = Math.max(0, Math.min(2400, Number(req.query.w) || 0));
    const h = Math.max(0, Math.min(2400, Number(req.query.h) || 0));
    const fit = String(req.query.fit || "cover");
    if (!src || (!w && !h)) return res.status(400).end("bad request");

    const disk = srcToDiskPath(src);
    if (!disk || !fs.existsSync(disk)) return res.status(404).end("not found");

    const ext = path.extname(disk).toLowerCase();
    const outExt = ext === ".gif" || ext === ".svg" ? ext : ".avif";
    const stat = await fsp.stat(disk);
    const key = crypto
      .createHash("sha1")
      .update(`${disk}|${stat.mtimeMs}|${stat.size}|w${w}|h${h}|f${fit}|${outExt}`)
      .digest("hex");
    const cached = path.join(CACHE_DIR, key + outExt);

    res.setHeader("Cache-Control", await cacheControlHeader("image"));
    res.setHeader("Content-Type", MIME[outExt] || "application/octet-stream");

    if (fs.existsSync(cached)) return res.sendFile(cached);

    if (outExt === ".gif" || outExt === ".svg") return res.sendFile(disk);

    const sharp = await getSharp();
    if (!sharp) {
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      return res.sendFile(disk);
    }
    let pipeline = sharp(disk, { failOn: "none" }).rotate();
    if (w || h) {
      pipeline = pipeline.resize({
        width: w || undefined,
        height: h || undefined,
        fit: fit === "contain" ? "contain" : "cover",
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    pipeline = pipeline.avif({ quality: 55, effort: 4 });
    const buf = await pipeline.toBuffer();
    await fsp.writeFile(cached, buf).catch(() => {});
    return res.end(buf);
  } catch (err) {
    console.error("/img error", err);
    return res.status(500).end("img error");
  }
});
