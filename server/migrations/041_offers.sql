-- Promotional offers engine.
-- Offer types: cart_percent, cart_amount, bogo, buy_x_get_y.
-- Per-type rules live in the `config` JSON column to keep the schema small.

CREATE TABLE IF NOT EXISTS offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  type ENUM('cart_percent','cart_amount','bogo','buy_x_get_y') NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  image_url VARCHAR(500) NOT NULL DEFAULT '',
  config LONGTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  priority INT NOT NULL DEFAULT 0,
  stackable TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  days_of_week TINYINT UNSIGNED NOT NULL DEFAULT 127, -- bit 0=Sun..6=Sat; 127 = every day
  time_from VARCHAR(5) DEFAULT NULL, -- 'HH:MM'
  time_to VARCHAR(5) DEFAULT NULL,
  dining_option ENUM('any','dine_in','takeout','delivery') NOT NULL DEFAULT 'any',
  max_uses_per_order INT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_offers_active (is_active, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offer_redemptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  offer_id INT NOT NULL,
  order_id INT NOT NULL,
  amount_saved DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_or_offer (offer_id),
  INDEX idx_or_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
