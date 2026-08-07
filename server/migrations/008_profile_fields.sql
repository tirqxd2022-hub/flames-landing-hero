-- Profile fields for staff (admin_users) and customers.
ALTER TABLE admin_users
  ADD COLUMN full_name VARCHAR(120) NULL,
  ADD COLUMN phone VARCHAR(40) NULL,
  ADD COLUMN avatar_url VARCHAR(500) NULL;

ALTER TABLE customers
  ADD COLUMN avatar_url VARCHAR(500) NULL;
