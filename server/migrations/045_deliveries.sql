-- Uber Direct (and future provider) delivery records.
-- Each row tracks a courier-side dispatch for an order. The order itself
-- remains the source of truth for customer details and totals.

CREATE TABLE IF NOT EXISTS deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'uber_direct',
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  quote_id VARCHAR(120) DEFAULT NULL,
  delivery_id VARCHAR(120) DEFAULT NULL,
  fee_cents INT DEFAULT NULL,
  currency VARCHAR(8) DEFAULT 'CAD',
  pickup_eta DATETIME DEFAULT NULL,
  dropoff_eta DATETIME DEFAULT NULL,
  tracking_url VARCHAR(500) DEFAULT NULL,
  courier_name VARCHAR(160) DEFAULT NULL,
  courier_phone VARCHAR(40) DEFAULT NULL,
  courier_location_json LONGTEXT NULL,
  raw_quote_json LONGTEXT NULL,
  raw_delivery_json LONGTEXT NULL,
  last_event_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deliveries_order (order_id),
  INDEX idx_deliveries_delivery_id (delivery_id),
  INDEX idx_deliveries_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
