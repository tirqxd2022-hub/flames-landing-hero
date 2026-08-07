/**
 * Newsletter portal — subscribers (mailing list), saved templates, campaigns.
 * Mounted onto the adminRouter; all paths begin with /newsletter.
 */
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { sendEmail } from "../lib/email.js";

export const newsletterRouter = Router();

const AUDIENCES = ["subscribers"]; // customers table has no email column today; subscribers only.

// -------- Subscribers (mailing list) --------
newsletterRouter.get("/newsletter/subscribers", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(5, Number(req.query.limit) || 50));
    const q = String(req.query.q || "").trim();
    const offset = (page - 1) * limit;
    const where = q ? "WHERE email LIKE ? OR name LIKE ?" : "";
    const params = q ? [`%${q}%`, `%${q}%`] : [];
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM newsletter_subscribers ${where}`, params,
    );
    const [items] = await pool.query(
      `SELECT id, email, name, source, status, created_at FROM newsletter_subscribers ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ items, total: Number(countRows[0]?.c || 0), page, limit });
  } catch (e) { next(e); }
});

const addSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(160).optional(),
});
newsletterRouter.post("/newsletter/subscribers", async (req, res, next) => {
  try {
    const p = addSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const email = p.data.email.toLowerCase();
    const [ex] = await pool.query("SELECT id FROM newsletter_subscribers WHERE email = ?", [email]);
    if (ex.length) return res.status(409).json({ error: "Already on the list." });
    const [r] = await pool.query(
      "INSERT INTO newsletter_subscribers (email, name, source) VALUES (?, ?, 'manual')",
      [email, p.data.name || null],
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  name: z.string().trim().max(160).nullable().optional(),
});
newsletterRouter.patch("/newsletter/subscribers/:id", async (req, res, next) => {
  try {
    const p = updateSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const fields = []; const vals = [];
    if (p.data.email !== undefined) { fields.push("email = ?"); vals.push(p.data.email.toLowerCase()); }
    if (p.data.name !== undefined) { fields.push("name = ?"); vals.push(p.data.name); }
    if (!fields.length) return res.json({ ok: true });
    vals.push(Number(req.params.id));
    try {
      await pool.query(`UPDATE newsletter_subscribers SET ${fields.join(", ")} WHERE id = ?`, vals);
    } catch (e) {
      if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists." });
      throw e;
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

newsletterRouter.delete("/newsletter/subscribers/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM newsletter_subscribers WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const importSchema = z.object({
  items: z.array(z.object({
    email: z.string().trim().email().max(255),
    name: z.string().trim().max(160).optional(),
  })).min(1).max(20000),
});
newsletterRouter.post("/newsletter/subscribers/import", async (req, res, next) => {
  try {
    const p = importSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid file" });
    let added = 0, skipped = 0;
    for (const it of p.data.items) {
      const email = it.email.toLowerCase();
      try {
        const [ex] = await pool.query("SELECT id FROM newsletter_subscribers WHERE email = ?", [email]);
        if (ex.length) { skipped++; continue; }
        await pool.query(
          "INSERT INTO newsletter_subscribers (email, name, source) VALUES (?, ?, 'import')",
          [email, it.name || null],
        );
        added++;
      } catch { skipped++; }
    }
    res.json({ added, skipped, total: p.data.items.length });
  } catch (e) { next(e); }
});

newsletterRouter.post("/newsletter/subscribers/import-customers", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT email, name FROM customers WHERE subscribed = 1 AND email IS NOT NULL",
    );
    let added = 0, skipped = 0;
    for (const it of rows) {
      const email = String(it.email || "").toLowerCase();
      if (!email) { skipped++; continue; }
      try {
        const [r] = await pool.query(
          "INSERT IGNORE INTO newsletter_subscribers (email, name, source) VALUES (?, ?, 'customer')",
          [email, it.name || null],
        );
        if (r.affectedRows > 0) added++; else skipped++;
      } catch { skipped++; }
    }
    res.json({ added, skipped, total: rows.length });
  } catch (e) { next(e); }
});

newsletterRouter.get("/newsletter/audience-stats", async (_req, res, next) => {
  try {
    const [s] = await pool.query("SELECT COUNT(*) AS c FROM newsletter_subscribers WHERE status='subscribed'");
    res.json({ subscribers: Number(s[0]?.c || 0) });
  } catch (e) { next(e); }
});

// -------- Campaigns / Send --------
newsletterRouter.get("/newsletter/campaigns", async (_req, res, next) => {
  try {
    const [items] = await pool.query(
      "SELECT id, subject, audience, sent_count, failed_count, sent_by, created_at FROM newsletter_campaigns ORDER BY id DESC LIMIT 50",
    );
    res.json({ items });
  } catch (e) { next(e); }
});

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  html: z.string().trim().min(1).max(500_000),
  audience: z.enum(AUDIENCES).default("subscribers"),
});
newsletterRouter.post("/newsletter/send", async (req, res, next) => {
  try {
    const p = sendSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const [rows] = await pool.query(
      "SELECT email, name FROM newsletter_subscribers WHERE status = 'subscribed'",
    );
    if (rows.length === 0) return res.status(400).json({ error: "No recipients on the mailing list." });
    const text = p.data.html.replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let sent = 0, failed = 0;
    for (const r of rows) {
      try { await sendEmail({ to: r.email, subject: p.data.subject, html: p.data.html, text }); sent++; }
      catch (e) { console.error("[newsletter]", r.email, e?.message); failed++; }
    }
    try {
      await pool.query(
        "INSERT INTO newsletter_campaigns (subject, html, audience, sent_count, failed_count, sent_by) VALUES (?, ?, ?, ?, ?, ?)",
        [p.data.subject, p.data.html, p.data.audience, sent, failed, req.admin?.username || null],
      );
    } catch { /* non-fatal */ }
    res.json({ ok: true, sent, failed, total: rows.length });
  } catch (e) { next(e); }
});

// -------- Templates --------
const tplSchema = z.object({
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(255).optional().default(""),
  html: z.string().trim().min(1).max(500_000),
});
newsletterRouter.get("/newsletter/templates", async (_req, res, next) => {
  try {
    const [items] = await pool.query(
      "SELECT id, name, subject, html, updated_at FROM newsletter_templates ORDER BY updated_at DESC",
    );
    res.json({ items });
  } catch (e) { next(e); }
});
newsletterRouter.post("/newsletter/templates", async (req, res, next) => {
  try {
    const p = tplSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const [r] = await pool.query(
      "INSERT INTO newsletter_templates (name, subject, html) VALUES (?, ?, ?)",
      [p.data.name, p.data.subject || "", p.data.html],
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});
newsletterRouter.put("/newsletter/templates/:id", async (req, res, next) => {
  try {
    const p = tplSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    await pool.query(
      "UPDATE newsletter_templates SET name=?, subject=?, html=? WHERE id=?",
      [p.data.name, p.data.subject || "", p.data.html, Number(req.params.id)],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
newsletterRouter.delete("/newsletter/templates/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM newsletter_templates WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
