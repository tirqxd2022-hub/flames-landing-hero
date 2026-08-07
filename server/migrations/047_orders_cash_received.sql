-- Store cash tendered by customer for cash payments (used on printed receipt to show change).
ALTER TABLE orders
  ADD COLUMN cash_received DECIMAL(10,2) NULL DEFAULT NULL AFTER payment_method;
