import { pool } from "../db.js";

// Auto-cancel any online unpaid order older than 30 minutes.
// Excludes pre-orders (scheduled, paid at pickup) and counter orders
// (created by admin/staff from the create-order page).
// Uses TIMESTAMPDIFF so the comparison is timezone-safe regardless of
// the MySQL session timezone vs. Node TZ.
let lastRun = 0;
export async function autoCancelStaleUnpaidOrders(force = false) {
  const now = Date.now();
  if (!force && now - lastRun < 15_000) return; // throttle: at most every 15s
  lastRun = now;
  try {
    await pool.query(
      `UPDATE orders
          SET status = 'cancelled'
        WHERE paid_at IS NULL
          AND status IN ('new','preparing')
          AND (is_preorder = 0 OR is_preorder IS NULL)
          AND created_by_admin_id IS NULL
          AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= 30`
    );
  } catch (e) {
    console.error("[auto-cancel]", e.message);
  }
}
