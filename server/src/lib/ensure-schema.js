import { pool } from "../db.js";

/**
 * Idempotently add columns / tables that later migrations introduce, so that
 * a fresh code deploy against a database that hasn't run the latest .sql
 * files still works. Column ALTERs are wrapped in try/catch so
 * "duplicate column" (ER 1060) is silently ignored.
 */
const ORDER_COLUMNS = [
  ["cash_received", "DECIMAL(10,2) NULL DEFAULT NULL"],       // 047
  ["staff_username", "VARCHAR(80) NULL DEFAULT NULL"],         // 042
  ["delivery_address", "TEXT NULL"],                            // 046
  ["delivery_instructions", "TEXT NULL"],                       // 046
  ["delivery_lat", "DECIMAL(10,7) NULL"],                       // 046
  ["delivery_lng", "DECIMAL(10,7) NULL"],                       // 046
  ["customer_lat", "DECIMAL(10,7) NULL"],                       // 046
  ["customer_lng", "DECIMAL(10,7) NULL"],                       // 046
  ["customer_loc_at", "DATETIME NULL"],                         // 046
  ["delivery_fee_cents", "INT NULL DEFAULT NULL"],              // 048
];

const CREATE_STAFF_ATTENDANCE = `
  CREATE TABLE IF NOT EXISTS staff_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(80) NOT NULL,
    check_in_at DATETIME NOT NULL,
    check_out_at DATETIME NULL,
    check_in_ip VARCHAR(64) NULL,
    check_out_ip VARCHAR(64) NULL,
    source ENUM('login_modal','manual','auto') NOT NULL DEFAULT 'login_modal',
    notes VARCHAR(255) NULL,
    work_date DATE NOT NULL,
    INDEX (user_id, work_date),
    INDEX (work_date),
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export async function ensureOrderSchema() {
  for (const [col, ddl] of ORDER_COLUMNS) {
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN ${col} ${ddl}`);
      console.log(`[schema] added orders.${col}`);
    } catch (e) {
      if (e && (e.errno === 1060 || /duplicate column/i.test(e.message || ""))) continue;
      console.warn(`[schema] could not add orders.${col}:`, e.message);
    }
  }
  try {
    await pool.query(CREATE_STAFF_ATTENDANCE);
  } catch (e) {
    console.warn("[schema] could not create staff_attendance:", e.message);
  }
}
