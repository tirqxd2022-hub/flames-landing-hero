-- Fix production media paths and ensure the owner account can see all admin pages.

UPDATE admin_users
SET permissions = NULL
WHERE role = 'admin';

UPDATE admin_users
SET is_super = 1, role = 'admin', permissions = NULL
WHERE id = (
  SELECT id FROM (SELECT id FROM admin_users ORDER BY id ASC LIMIT 1) AS first_admin
)
AND NOT EXISTS (
  SELECT 1 FROM (SELECT id FROM admin_users WHERE is_super = 1 LIMIT 1) AS existing_super
);

UPDATE products SET image_url = '/products/egg-bhurji-indian-style.jpeg' WHERE slug = 'egg-bhurji-indian-style';
UPDATE products SET image_url = '/products/vege-shakahari-scrambled-egg.jpeg' WHERE slug = 'vege-shakahari-scrambled-egg';
UPDATE products SET image_url = '/products/plain-scrambled-egg.jpeg' WHERE slug = 'only-egg-scramble';
UPDATE products SET image_url = '/products/vege-shakahari-omelette.jpeg' WHERE slug = 'vege-shakahari-omelette';
UPDATE products SET image_url = '/products/flames-indian-style-omelette.jpeg' WHERE slug = 'flames-indian-style-omelette';
UPDATE products SET image_url = '/products/all-cheesey-omelette.jpeg' WHERE slug = 'all-cheesey-omelette';
UPDATE products SET image_url = '/products/plain-omelette.jpeg' WHERE slug = 'plain-omlette';
UPDATE products SET image_url = '/products/tuna-salad-sandwich.jpg' WHERE slug = 'tuna-salad-sandwich';
UPDATE products SET image_url = '/products/chicken-salad-sandwich.jpg' WHERE slug = 'chicken-salad-sandwich';
UPDATE products SET image_url = '/products/egg-cheese-sandwich.jpeg' WHERE slug = 'egg-cheese-sandwich';
UPDATE products SET image_url = '/products/pan-cakes-3pc.jpeg' WHERE slug = 'pan-cakes-3pc';
UPDATE products SET image_url = '/products/pav-bhaji.jpg' WHERE slug = 'pav-bhaji';

INSERT INTO site_settings (k, v) VALUES ('logo_url', '/uploads/flames-logo.png')
ON DUPLICATE KEY UPDATE v = IF(v IS NULL OR v = '' OR v LIKE '/__l5e/%', VALUES(v), v);
