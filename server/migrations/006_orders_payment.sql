-- Add payment fields to orders
ALTER TABLE orders
  ADD COLUMN payment_method VARCHAR(20) DEFAULT NULL,
  ADD COLUMN paid_at TIMESTAMP NULL DEFAULT NULL;
