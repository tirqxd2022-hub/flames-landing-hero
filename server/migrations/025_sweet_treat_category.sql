-- New "Sweet Treat" category with Ethnic Bites, Indian Sweets and
-- Cheese Cakes subcategories.

-- 1. Category
INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('sweet-treat', 'Sweet Treat', 'Home-baked cakes, classic Indian sweets and cheese cakes.', '', 27)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order);

-- 2. Subcategories
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'ethnic-bites'  AS slug, 'Ethnic Bites'  AS name, 0 AS sort_order UNION ALL
  SELECT 'indian-sweets',        'Indian Sweets',         1 UNION ALL
  SELECT 'cheese-cakes',         'Cheese Cakes',          2
) x
WHERE c.slug = 'sweet-treat'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 3. Products
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, '', 1, 1, 5.0, t.so
FROM categories c
JOIN (
  -- Ethnic Bites
  SELECT 'sweet-plain-vanilla'         AS slug, 'ethnic-bites' AS sub, 'Plain Vanilla'              AS name, 'Soft plain vanilla cake slice.'              AS descr, 2.99 AS price, 0 AS so UNION ALL
  SELECT 'sweet-mixed-fruit-cake',            'ethnic-bites',         'Mixed Fruit Cake',                  'Mixed fruit cake slice.',                            3.49,        1 UNION ALL
  SELECT 'sweet-coconut-cake',                'ethnic-bites',         'Coconut Cake',                      'Moist coconut cake slice.',                          3.29,        2 UNION ALL
  SELECT 'sweet-carrot-cake',                 'ethnic-bites',         'Carrot Cake',                       'Spiced carrot cake slice.',                          3.29,        3 UNION ALL
  SELECT 'sweet-carrot-walnut-cake',          'ethnic-bites',         'Carrot & Wallnut Cake',             'Carrot and walnut cake slice.',                      3.49,        4 UNION ALL
  -- Indian Sweets
  SELECT 'sweet-gulab-jamun-2pc',             'indian-sweets',        'Gulab Jamun (2 pc)',                'Two warm gulab jamuns in sugar syrup.',              2.99,        0 UNION ALL
  SELECT 'sweet-kheer-plain',                 'indian-sweets',        'Kheer (Plain)',                     'Slow-cooked rice pudding.',                          3.99,        1 UNION ALL
  SELECT 'sweet-kheer-nuts-raisins',          'indian-sweets',        'Kheer (Nuts & Raisons)',            'Rice pudding with mixed nuts and raisins.',          4.99,        2 UNION ALL
  -- Cheese Cakes
  SELECT 'sweet-mixed-berry-cheese-cake',     'cheese-cakes',         'Mixed Berry Cheese Cake',           'Creamy cheese cake topped with mixed berries.',      4.99,        0 UNION ALL
  SELECT 'sweet-mango-cheese-cake',           'cheese-cakes',         'Mango Cheese Cake',                 'Creamy cheese cake with mango topping.',             4.99,        1 UNION ALL
  SELECT 'sweet-mixed-berry-danish',          'cheese-cakes',         'Mixed Berry Danish',                'Flaky pastry filled with mixed berries.',            3.99,        2 UNION ALL
  SELECT 'sweet-apple-cinnamon-danish',       'cheese-cakes',         'Apple Cinnamon Danish',             'Flaky pastry filled with apple and cinnamon.',       3.99,        3
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'sweet-treat'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order);
