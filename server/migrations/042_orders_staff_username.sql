-- Snapshot the admin username that punched the order so it survives
-- admin_users renames/deletes and is cheap to display.
ALTER TABLE orders
  ADD COLUMN staff_username VARCHAR(80) NULL DEFAULT NULL AFTER created_by_admin_id;

-- Backfill existing rows from admin_users where possible.
UPDATE orders o
  JOIN admin_users u ON u.id = o.created_by_admin_id
  SET o.staff_username = u.username
  WHERE o.staff_username IS NULL;
