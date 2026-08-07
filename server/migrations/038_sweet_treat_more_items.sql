-- Add more bakery items under "Sweet Treat" (dessert) category.
-- Idempotent: INSERT IGNORE skips rows whose slug already exists.

INSERT IGNORE INTO products
  (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, t.img, 1, 1, 5.0, t.so
FROM categories c
JOIN (
  SELECT 'sweet-muffins'                AS slug, 'ethnic-bites' AS sub, 'Muffins'                AS name, 'Freshly baked muffin.'                       AS descr, 3.25 AS price, '/products/sweet-muffins.jpg'                AS img, 10 AS so UNION ALL
  SELECT 'sweet-cinnamon-buns',                'ethnic-bites',         'Cinnamon Buns',                  'Soft cinnamon bun with sweet glaze.',                3.99,        '/products/sweet-cinnamon-buns.jpg',                11 UNION ALL
  SELECT 'sweet-chocolate-chip-cookies',       'ethnic-bites',         'Chocolate Chip Cookies',         'Classic chocolate chip cookie.',                     1.99,        '/products/sweet-chocolate-chip-cookies.jpg',       12 UNION ALL
  SELECT 'sweet-strawberry-danish',            'cheese-cakes',         'Strawberry Danish',              'Flaky pastry filled with strawberry.',               3.99,        '/products/sweet-strawberry-danish.jpg',            10
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'sweet-treat';
