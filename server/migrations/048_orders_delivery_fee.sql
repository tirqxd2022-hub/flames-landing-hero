-- Persist the delivery fee that the customer was quoted at checkout on the
-- order itself, so it can be shown on receipts / order details even before
-- (or without) an Uber Direct dispatch row being created.
ALTER TABLE orders
  ADD COLUMN delivery_fee_cents INT NULL DEFAULT NULL;
