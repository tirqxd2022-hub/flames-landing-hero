-- Add "Sandwich Corner" subcategory under Breakfast with 5 items.
-- Addon groups (Choice of Bread, Hot Beverages, Smoothies) are cloned
-- from an existing Breakfast product so the same dynamic options appear.

-- 1. Subcategory
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, 'sandwich-corner', 'Sandwich Corner', 50
FROM categories c
WHERE c.slug = 'breakfast'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 2. Products
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, '', t.veg, 1, 5.0, t.so
FROM categories c
JOIN subcategories s ON s.category_id = c.id AND s.slug = 'sandwich-corner'
JOIN (
  SELECT 'sandwich-cheese'                    AS slug, 'Cheese'                          AS name, 'Classic cheese sandwich.'                              AS descr, 2.99 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'sandwich-egg-salad',                       'Egg Salad',                              'Creamy egg salad sandwich.',                                  2.99,        0,        1 UNION ALL
  SELECT 'sandwich-chicken-salad',                   'Chicken Salad',                          'Tender chicken salad with herbs.',                            3.99,        0,        2 UNION ALL
  SELECT 'sandwich-tuna-salad',                      'Tuna Salad',                             'Classic tuna salad sandwich.',                                3.99,        0,        3 UNION ALL
  SELECT 'sandwich-fish-jalapeno-coleslaw',          'Fish with Jalepeno & Coleslaw',          'Crispy fish with jalapeno and tangy coleslaw.',               3.99,        0,        4
) t
WHERE c.slug = 'breakfast'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);

-- 3. Clone addon groups from an existing breakfast product (egg-bhurji-indian-style)
--    onto each new sandwich product, but only if the target has none yet.

-- Groups
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT tgt.id, g.name, g.selection_type, g.is_required, g.is_sized, g.sort_order
FROM products src
JOIN addon_groups g ON g.product_id = src.id
JOIN products tgt ON tgt.slug IN (
  'sandwich-cheese','sandwich-egg-salad','sandwich-chicken-salad','sandwich-tuna-salad','sandwich-fish-jalapeno-coleslaw'
)
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_groups ag WHERE ag.product_id = tgt.id AND ag.name = g.name);

-- Options
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT tgt_g.id, o.name, o.price, o.sort_order
FROM products src
JOIN addon_groups src_g ON src_g.product_id = src.id
JOIN addon_options o ON o.group_id = src_g.id
JOIN products tgt ON tgt.slug IN (
  'sandwich-cheese','sandwich-egg-salad','sandwich-chicken-salad','sandwich-tuna-salad','sandwich-fish-jalapeno-coleslaw'
)
JOIN addon_groups tgt_g ON tgt_g.product_id = tgt.id AND tgt_g.name = src_g.name
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_options ao WHERE ao.group_id = tgt_g.id AND ao.name = o.name);

-- Option sizes
INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order)
SELECT tgt_o.id, sz.slug, sz.name, sz.price, sz.sort_order
FROM products src
JOIN addon_groups src_g ON src_g.product_id = src.id
JOIN addon_options src_o ON src_o.group_id = src_g.id
JOIN addon_option_sizes sz ON sz.option_id = src_o.id
JOIN products tgt ON tgt.slug IN (
  'sandwich-cheese','sandwich-egg-salad','sandwich-chicken-salad','sandwich-tuna-salad','sandwich-fish-jalapeno-coleslaw'
)
JOIN addon_groups tgt_g ON tgt_g.product_id = tgt.id AND tgt_g.name = src_g.name
JOIN addon_options tgt_o ON tgt_o.group_id = tgt_g.id AND tgt_o.name = src_o.name
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_option_sizes aos WHERE aos.option_id = tgt_o.id AND aos.slug = sz.slug);
