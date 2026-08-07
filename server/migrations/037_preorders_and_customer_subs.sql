-- Pre-order support on orders + opt-in flag on customers.
ALTER TABLE orders
  ADD COLUMN is_preorder TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN preorder_at DATETIME NULL DEFAULT NULL,
  ADD INDEX idx_orders_preorder (is_preorder, preorder_at);

-- Whether the customer opted in to the mailing list at signup.
ALTER TABLE customers
  ADD COLUMN subscribed TINYINT(1) NOT NULL DEFAULT 1;
