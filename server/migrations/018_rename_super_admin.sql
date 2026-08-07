-- Rename the default super admin username from "admin" to "prithwish".
UPDATE admin_users SET username = 'prithwish' WHERE username = 'admin' AND is_super = 1;
