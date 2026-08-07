-- New "Fusion" category with Soft Grilled Tacos and Flat Bread Mini Pizza
-- subcategories. Hot Beverages and Smoothies addon groups are cloned from
-- an existing Breakfast product so the same dynamic options appear.

-- 1. Category
INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('fusion', 'Fusion', 'Mon-Fri 11AM-6PM. Fusion-style tacos and flatbread pizzas.', '', 26)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order);

-- 2. Subcategories
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'soft-grilled-tacos'   AS slug, 'Soft Grilled Tacos'   AS name, 0 AS sort_order UNION ALL
  SELECT 'flat-bread-mini-pizza',       'Flat Bread Mini Pizza',        1
) x
WHERE c.slug = 'fusion'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 3. Products — Soft Grilled Tacos (base price = 0; 1pc / 2pc carried by Quantity addon)
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, 0, '', t.veg, 1, 5.0, t.so
FROM categories c
JOIN subcategories s ON s.category_id = c.id AND s.slug = 'soft-grilled-tacos'
JOIN (
  SELECT 'fusion-vege-tacos'           AS slug, 'Vege Tacos'           AS name, 'Fillings of curry kidney beans, onion, mixed bell pepper & tomato with mozzarella, cheddar and white cheese. Served with fries, house special salad & sauce.' AS descr, 1 AS veg, 0 AS so UNION ALL
  SELECT 'fusion-butter-chicken-tacos',       'Butter Chicken Tacos',         'Fillings of flames butter chicken, roasted onion & tomato with mozzarella, cheddar and white cheese. Served with fries, house special salad & sauce.', 0,        1 UNION ALL
  SELECT 'fusion-shrimp-tacos',                'Shrimp Tacos',                 'Fillings of sauteed ajwain shrimps, roasted onion & tomato with mozzarella, cheddar and white cheese. Served with fries, house special salad & sauce.',    0,        2
) t
WHERE c.slug = 'fusion'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);

-- 4. Products — Flat Bread Mini Pizza
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, '', t.veg, 1, 5.0, t.so
FROM categories c
JOIN subcategories s ON s.category_id = c.id AND s.slug = 'flat-bread-mini-pizza'
JOIN (
  SELECT 'fusion-pizza-only-cheese'   AS slug, 'Only Cheese'    AS name, 'Crispy thin crust flatbread pizza with cheese.'                              AS descr, 8.99  AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'fusion-pizza-vege-shakahari',       'Vege Shakahari',         'Onion, mixed bell pepper & tomato on crispy thin crust flatbread pizza.',           10.99,        1,        1 UNION ALL
  SELECT 'fusion-pizza-hawaiin-vege',         'Hawaiin Vege',           'Topped with chunks of pineapple and veges on crispy thin crust flatbread.',         11.99,        1,        2 UNION ALL
  SELECT 'fusion-pizza-butter-chicken',       'Butter Chicken',         'Topped with Flames creamy butter chicken on crispy thin crust flatbread.',          12.99,        0,        3
) t
WHERE c.slug = 'fusion'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);

-- 5. Quantity addon group (1 pc / 2 pc) for each taco product
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT p.id, 'Quantity', 'single', 1, 0, 0
FROM products p
WHERE p.slug IN ('fusion-vege-tacos','fusion-butter-chicken-tacos','fusion-shrimp-tacos')
  AND NOT EXISTS (SELECT 1 FROM addon_groups g WHERE g.product_id = p.id AND g.name = 'Quantity');

-- Quantity options per taco product (price per piece-count)
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT g.id, t.name, t.price, t.so
FROM products p
JOIN addon_groups g ON g.product_id = p.id AND g.name = 'Quantity'
JOIN (
  SELECT 'fusion-vege-tacos'           AS slug, '1 pc' AS name, 6.99 AS price, 0 AS so UNION ALL
  SELECT 'fusion-vege-tacos',                 '2 pc',        9.99,        1 UNION ALL
  SELECT 'fusion-butter-chicken-tacos',       '1 pc',        8.99,        0 UNION ALL
  SELECT 'fusion-butter-chicken-tacos',       '2 pc',       13.99,        1 UNION ALL
  SELECT 'fusion-shrimp-tacos',               '1 pc',        9.99,        0 UNION ALL
  SELECT 'fusion-shrimp-tacos',               '2 pc',       14.99,        1
) t ON t.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM addon_options o WHERE o.group_id = g.id AND o.name = t.name
);

-- 6. Clone Hot Beverages and Smoothies addon groups from an existing breakfast
--    product (egg-bhurji-indian-style) onto every Fusion product.

-- Groups
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT tgt.id, g.name, g.selection_type, g.is_required, g.is_sized, g.sort_order + 10
FROM products src
JOIN addon_groups g ON g.product_id = src.id AND g.name IN ('Hot Beverages','Smoothies')
JOIN products tgt ON tgt.slug IN (
  'fusion-vege-tacos','fusion-butter-chicken-tacos','fusion-shrimp-tacos',
  'fusion-pizza-only-cheese','fusion-pizza-vege-shakahari','fusion-pizza-hawaiin-vege','fusion-pizza-butter-chicken'
)
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_groups ag WHERE ag.product_id = tgt.id AND ag.name = g.name);

-- Options
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT tgt_g.id, o.name, o.price, o.sort_order
FROM products src
JOIN addon_groups src_g ON src_g.product_id = src.id AND src_g.name IN ('Hot Beverages','Smoothies')
JOIN addon_options o ON o.group_id = src_g.id
JOIN products tgt ON tgt.slug IN (
  'fusion-vege-tacos','fusion-butter-chicken-tacos','fusion-shrimp-tacos',
  'fusion-pizza-only-cheese','fusion-pizza-vege-shakahari','fusion-pizza-hawaiin-vege','fusion-pizza-butter-chicken'
)
JOIN addon_groups tgt_g ON tgt_g.product_id = tgt.id AND tgt_g.name = src_g.name
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_options ao WHERE ao.group_id = tgt_g.id AND ao.name = o.name);

-- Option sizes (S/M/L)
INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order)
SELECT tgt_o.id, sz.slug, sz.name, sz.price, sz.sort_order
FROM products src
JOIN addon_groups src_g ON src_g.product_id = src.id AND src_g.name IN ('Hot Beverages','Smoothies')
JOIN addon_options src_o ON src_o.group_id = src_g.id
JOIN addon_option_sizes sz ON sz.option_id = src_o.id
JOIN products tgt ON tgt.slug IN (
  'fusion-vege-tacos','fusion-butter-chicken-tacos','fusion-shrimp-tacos',
  'fusion-pizza-only-cheese','fusion-pizza-vege-shakahari','fusion-pizza-hawaiin-vege','fusion-pizza-butter-chicken'
)
JOIN addon_groups tgt_g ON tgt_g.product_id = tgt.id AND tgt_g.name = src_g.name
JOIN addon_options tgt_o ON tgt_o.group_id = tgt_g.id AND tgt_o.name = src_o.name
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_option_sizes aos WHERE aos.option_id = tgt_o.id AND aos.slug = sz.slug);
