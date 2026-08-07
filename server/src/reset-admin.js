// One-shot password reset for an admin_users row.
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_NEW_PASSWORD='newPass123' \
//   node src/reset-admin.js
//
// If the user doesn't exist it is created as a super admin.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const pwd = process.env.ADMIN_NEW_PASSWORD;
  if (!email || !pwd) {
    console.error("Set ADMIN_EMAIL and ADMIN_NEW_PASSWORD env vars.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(pwd, 12);
  const username = (email.split("@")[0] || "owner").replace(/[^a-zA-Z0-9_.-]+/g, "").slice(0, 64) || "owner";
  const [r] = await pool.query(
    `INSERT INTO admin_users (username, email, password_hash, is_super, role)
       VALUES (?, ?, ?, 1, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_super = 1`,
    [username, email, hash],
  );
  // Also reset legacy admins table if present.
  try {
    await pool.query(
      `INSERT INTO admins (email, password_hash, name) VALUES (?, ?, 'Owner')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [email, await bcrypt.hash(pwd, 10)],
    );
  } catch { /* legacy table may not exist — fine */ }
  console.log(`✓ password reset for ${email} (affectedRows=${r.affectedRows})`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
