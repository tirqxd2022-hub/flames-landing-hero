-- Delivery fields on orders. Required so an online "delivery" order can carry
-- the dropoff address + (optional) live geolocation from the customer device.
-- Without these columns, Uber Direct dispatch has nothing to send.

ALTER TABLE orders
  ADD COLUMN delivery_address VARCHAR(500) DEFAULT NULL,
  ADD COLUMN delivery_instructions VARCHAR(500) DEFAULT NULL,
  ADD COLUMN delivery_lat DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN delivery_lng DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN customer_lat DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN customer_lng DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN customer_loc_at DATETIME DEFAULT NULL;
