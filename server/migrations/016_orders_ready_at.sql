-- Track when a kitchen order reached the "ready" state.
ALTER TABLE orders
  ADD COLUMN ready_at TIMESTAMP NULL DEFAULT NULL;
