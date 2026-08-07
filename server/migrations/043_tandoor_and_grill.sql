-- New "Tandoor & Grill" category with Vegetarian and Non-Vegetarian subcategories.

INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('tandoor-and-grill', 'Tandoor & Grill', 'Smoky tandoor kebabs and grilled specialties.', '', 30)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order);

INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'vegetarian'     AS slug, 'Vegetarian'     AS name, 0 AS sort_order UNION ALL
  SELECT 'non-vegetarian',        'Non-Vegetarian',        1
) x
WHERE c.slug = 'tandoor-and-grill'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, CONCAT('/products/', t.slug, '.jpg'), t.veg, 1, 5.0, t.so
FROM categories c
JOIN (
  SELECT 'tg-grilled-mixed-vege'  AS slug, 'vegetarian'     AS sub, 'Grilled Mixed Vege'  AS name, 'Marinated mixed seasonal veges and grilled.'                                                AS descr, 11.99 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'tg-paneer-tikka',              'vegetarian',            'Paneer Tikka',              'Spiced Cottage Cheese in a delicate creamy marinade.',                                                13.99,         1,        1 UNION ALL
  SELECT 'tg-malai-tikka',               'non-vegetarian',        'Malai Tikka',               'Grilled boneless chicken kebab in a delicate creamy marinade.',                                       15.99,         0,        0 UNION ALL
  SELECT 'tg-chicken-tikka',             'non-vegetarian',        'Chicken Tikka',             'Our version of traditional boneless tandoori chicken tikka.',                                         14.99,         0,        1 UNION ALL
  SELECT 'tg-haryali-chk-tikka',         'non-vegetarian',        'Haryali Chk Tikka',         'Grilled boneless chicken kebab in a delicate creamy green chutney marinade.',                         15.99,         0,        2 UNION ALL
  SELECT 'tg-jumbo-pawn',                'non-vegetarian',        'Jumbo Pawn',                'Grilled Scrumptious Jumbo Prawns lightly marinated.',                                                 19.99,         0,        3 UNION ALL
  SELECT 'tg-grilled-chicken-leg',       'non-vegetarian',        'Grilled Chicken Leg',       'Grilled chicken Leg on bone marinated in yogurt and house special tandoori masala.',                  13.99,         0,        4 UNION ALL
  SELECT 'tg-grilled-platter',           'non-vegetarian',        'Grilled Platter',           'Mix of Veg and Non Veg Grilled Items (1pc each) served with 2 naans and chutneys.',                   29.99,         0,        5
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'tandoor-and-grill'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);
