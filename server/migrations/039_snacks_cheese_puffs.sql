-- Add Cheese Puffs under "Snacks & Chaat Corner".
-- All other items from the chalkboard already exist:
--   Veg Patties, Chicken Patties, Veg Samosa, Veg Spring Roll  (snacks)
--   Tuna / Chicken / Fish / Egg / Cheese Sandwich              (sandwich-corner)
-- Idempotent via INSERT IGNORE on the unique slug.

INSERT IGNORE INTO products
  (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT 'snack-cheese-puffs', c.id, NULL, 'Cheese Puffs',
       'Golden flaky pastry puffs filled with melty cheese.',
       'Golden flaky pastry puffs filled with melty cheese.',
       2.99, '/products/snack-cheese-puffs.jpg', 1, 1, 5.0, 8
FROM categories c
WHERE c.slug = 'snacks-chaat-corner';
