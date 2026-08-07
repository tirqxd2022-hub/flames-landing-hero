/**
 * Admin customers — list and manage signed-up customer accounts.
 * Mounted onto the adminRouter; all paths begin with /customers.
 */
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const customersRouter = Router();

customersRouter.get("/customers", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(5, Number(req.query.limit) || 50));
    const q = String(req.query.q || "").trim();
    const offset = (page - 1) * limit;
    const where = q ? "WHERE email LIKE ? OR name LIKE ? OR phone LIKE ?" : "";
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM customers ${where}`, params,
    );
    const [items] = await pool.query(
      `SELECT c.id, c.email, c.name, c.phone, c.subscribed, c.created_at, c.last_login_at,
              (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders_count
         FROM customers c ${where}
         ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ items, total: Number(countRows[0]?.c || 0), page, limit });
  } catch (e) { next(e); }
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  subscribed: z.boolean().optional(),
});
customersRouter.patch("/customers/:id", async (req, res, next) => {
  try {
    const p = patchSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const fields = []; const vals = [];
    if (p.data.name !== undefined) { fields.push("name = ?"); vals.push(p.data.name); }
    if (p.data.phone !== undefined) { fields.push("phone = ?"); vals.push(p.data.phone || null); }
    if (p.data.subscribed !== undefined) { fields.push("subscribed = ?"); vals.push(p.data.subscribed ? 1 : 0); }
    if (!fields.length) return res.json({ ok: true });
    vals.push(Number(req.params.id));
    await pool.query(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

customersRouter.delete("/customers/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM customers WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
