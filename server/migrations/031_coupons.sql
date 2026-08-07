-- Coupons + redemption tracking, and order-level discount columns.

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT '',
  type ENUM('percent','fixed','free_item') NOT NULL DEFAULT 'percent',
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  min_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  free_product_id INT DEFAULT NULL,
  starts_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  per_customer_limit INT DEFAULT NULL,
  used_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (free_product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  order_id INT NOT NULL,
  customer_phone VARCHAR(40) DEFAULT NULL,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX (customer_phone),
  INDEX (coupon_id, customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders
  ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN coupon_code VARCHAR(40) DEFAULT NULL,
  ADD COLUMN coupon_id INT DEFAULT NULL;
