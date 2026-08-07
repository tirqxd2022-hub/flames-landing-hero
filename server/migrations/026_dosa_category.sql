-- New "Dosa" category with Vegetarian, Non-Veg and Dosa Box subcategories.
-- Hot Beverages and Smoothies addon groups are cloned from an existing
-- Breakfast product so the same dynamic options appear on every Dosa item.

-- 1. Category
INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('dosa', 'Dosa', 'Crispy thin Indian crepes served with sambar & chutni.', '', 28)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order);

-- 2. Subcategories
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'vegetarian' AS slug, 'Vegetarian' AS name, 0 AS sort_order UNION ALL
  SELECT 'non-veg',           'Non Veg',           1 UNION ALL
  SELECT 'dosa-box',          'Dosa Box',          2
) x
WHERE c.slug = 'dosa'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 3. Products
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, '', t.veg, 1, 5.0, t.so
FROM categories c
JOIN (
  -- Vegetarian
  SELECT 'dosa-plain'              AS slug, 'vegetarian' AS sub, 'Plain Dosa'              AS name, 'Crispy thin Indian crepe.'                                                  AS descr,  7.99 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'dosa-mysore',                    'vegetarian',        'Mysore Dosa',                    'Crispy thin Indian crepe flavoured with Mysore masala.',                              8.49,         1,        1 UNION ALL
  SELECT 'dosa-masala',                    'vegetarian',        'Masala Dosa',                    'Crispy thin Indian crepe filled with flavoured mashed potato.',                       9.99,         1,        2 UNION ALL
  SELECT 'dosa-mysore-masala',             'vegetarian',        'Mysore Masala Dosa',             'Crispy thin Indian crepe filled with flavoured mashed potato & Mysore masala.',     10.99,         1,        3 UNION ALL
  SELECT 'dosa-cheese',                    'vegetarian',        'Cheese Dosa',                    'Crispy thin Indian crepe filled with mozzarella cheese.',                            11.99,         1,        4 UNION ALL
  SELECT 'dosa-cheese-masala',             'vegetarian',        'Cheese Masala Dosa',             'Crispy thin Indian crepe filled with flavoured mashed potato & Mysore masala.',    12.99,         1,        5 UNION ALL
  SELECT 'dosa-paneer-makhni',             'vegetarian',        'Paneer Makhni Dosa',             'Crispy thin Indian crepe filled with Paneer Makhni.',                                13.99,         1,        6 UNION ALL
  -- Non Veg
  SELECT 'dosa-egg',                       'non-veg',           'Egg Dosa',                       'Crispy thin Indian crepe filled with egg.',                                          10.99,         0,        0 UNION ALL
  SELECT 'dosa-butter-chicken',            'non-veg',           'Butter Chicken Dosa',            'Crispy thin Indian crepe filled with butter chicken.',                               13.99,         0,        1 UNION ALL
  SELECT 'dosa-chicken-egg',               'non-veg',           'Chicken & Egg Dosa',             'Crispy thin Indian crepe filled with egg & chicken.',                                14.99,         0,        2 UNION ALL
  -- Dosa Box
  SELECT 'dosa-box-vegetarian',            'dosa-box',          'Vegetarian Dosa Box',            'Served with choice of one side each, chutneys and drink.',                          12.99,         1,        0 UNION ALL
  SELECT 'dosa-box-non-veg',               'dosa-box',          'Non-Veg Dosa Box',               'Served with choice of one side each, chutneys and drink.',                          15.99,         0,        1
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'dosa'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);

-- 4. Clone Hot Beverages and Smoothies addon groups from egg-bhurji-indian-style.

-- Groups
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT tgt.id, g.name, g.selection_type, g.is_required, g.is_sized, g.sort_order + 10
FROM products src
JOIN addon_groups g ON g.product_id = src.id AND g.name IN ('Hot Beverages','Smoothies')
JOIN products tgt ON tgt.category_id = (SELECT id FROM categories WHERE slug = 'dosa')
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_groups ag WHERE ag.product_id = tgt.id AND ag.name = g.name);

-- Options
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT tgt_g.id, o.name, o.price, o.sort_order
FROM products src
JOIN addon_groups src_g ON src_g.product_id = src.id AND src_g.name IN ('Hot Beverages','Smoothies')
JOIN addon_options o ON o.group_id = src_g.id
JOIN products tgt ON tgt.category_id = (SELECT id FROM categories WHERE slug = 'dosa')
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
JOIN products tgt ON tgt.category_id = (SELECT id FROM categories WHERE slug = 'dosa')
JOIN addon_groups tgt_g ON tgt_g.product_id = tgt.id AND tgt_g.name = src_g.name
JOIN addon_options tgt_o ON tgt_o.group_id = tgt_g.id AND tgt_o.name = src_o.name
WHERE src.slug = 'egg-bhurji-indian-style'
  AND NOT EXISTS (SELECT 1 FROM addon_option_sizes aos WHERE aos.option_id = tgt_o.id AND aos.slug = sz.slug);
