-- Dining option for in-store orders: 'to_go' (takeaway) or 'to_stay' (dine-in).
ALTER TABLE orders
  ADD COLUMN dining_option VARCHAR(10) NOT NULL DEFAULT 'to_go';
