-- Customer accounts (site users) — separate from admin_users.
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  INDEX (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- (cPanel MySQL users already have full privileges on their own database,
-- so no extra GRANT is needed here. If you run this on a stock MySQL where
-- the app user has limited rights, also run:
--   GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO 'your_app_user'@'%';


-- Link orders to a customer (nullable to keep guest checkouts working).
ALTER TABLE orders
  ADD COLUMN customer_id INT NULL DEFAULT NULL,
  ADD COLUMN created_by_admin_id INT NULL DEFAULT NULL,
  ADD INDEX idx_orders_customer (customer_id);
