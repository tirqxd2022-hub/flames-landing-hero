/**
 * Contact form submissions admin endpoints. Mounted on adminRouter.
 */
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const submissionsRouter = Router();

submissionsRouter.get("/submissions", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(5, Number(req.query.limit) || 50));
    const q = String(req.query.q || "").trim();
    const filter = String(req.query.filter || "all"); // all|spam|ham
    const where = [];
    const params = [];
    if (q) { where.push("(email LIKE ? OR name LIKE ? OR message LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (filter === "spam") where.push("is_spam = 1");
    if (filter === "ham") where.push("is_spam = 0");
    const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * limit;
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM contact_submissions ${sql}`, params);
    const [items] = await pool.query(
      `SELECT id, name, email, phone, message, is_spam AS isSpam, spam_reason AS spamReason,
              ip, user_agent AS userAgent, sent_to AS sentTo, created_at AS createdAt
         FROM contact_submissions ${sql}
         ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({
      items: items.map((r) => ({ ...r, isSpam: !!r.isSpam })),
      total: Number(countRows[0]?.c || 0),
      page, limit,
    });
  } catch (e) { next(e); }
});

const patchSchema = z.object({ isSpam: z.boolean() });
submissionsRouter.patch("/submissions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    await pool.query("UPDATE contact_submissions SET is_spam = ? WHERE id = ?", [parsed.data.isSpam ? 1 : 0, id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

submissionsRouter.delete("/submissions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM contact_submissions WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
