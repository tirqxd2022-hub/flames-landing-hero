-- New "Fries Works" category with "Fries with toppings" (FT) and "Only Fries" (OF) subcategories.

INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('fries-works', 'Fries Works', 'Loaded gourmet fries and crispy classics.', '/uploads/category-fries-works.jpg', 31)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  image_url = VALUES(image_url), sort_order = VALUES(sort_order);

INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'fries-with-toppings' AS slug, 'Fries with toppings' AS name, 0 AS sort_order UNION ALL
  SELECT 'only-fries',                  'Only Fries',                  1
) x
WHERE c.slug = 'fries-works'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.descr, t.price, CONCAT('/products/', t.slug, '.jpg'), t.veg, 1, 5.0, t.so
FROM categories c
JOIN (
  SELECT 'ft-flames-butter-chicken' AS slug, 'fries-with-toppings' AS sub, 'FT Flames Butter Chicken' AS name, 'Topped with FLAMES mouth watering crunchy butter chicken & creamy sauce with a sprinkle of spring onion.' AS descr, 12.99 AS price, 0 AS veg, 0 AS so UNION ALL
  SELECT 'ft-vege-shakahari',              'fries-with-toppings',        'FT Vege Shakahari',              'Topped with our creamy cheese sauce, real sour cream, and fresh green onions and tomatoes.',                10.99,         1,        1 UNION ALL
  SELECT 'ft-mexicana',                    'fries-with-toppings',        'FT Mexicana',                    'Topped with our spicy cheese sauce, salsa, sour cream, and fresh spring onions.',                            10.99,         1,        2 UNION ALL
  SELECT 'ft-vegetarian-poutine',          'fries-with-toppings',        'FT Vegetarian Poutine',          'Topped with FLAMES vegetarian poutine gravy & cheese curds.',                                               10.99,         1,        3 UNION ALL
  SELECT 'of-flames-butter-chicken',       'only-fries',                 'OF Flames Butter Chicken',       'Crispy fries seasoned with our butter chicken spice blend, served plain.',                                   7.99,         0,        4 UNION ALL
  SELECT 'of-vege-shakahari',              'only-fries',                 'OF Vege Shakahari',              'Crispy fries seasoned with our shakahari herb mix, served plain.',                                           6.99,         1,        5 UNION ALL
  SELECT 'of-mexicana',                    'only-fries',                 'OF Mexicana',                    'Crispy fries with a spicy Mexicana seasoning, served plain.',                                                6.99,         1,        6 UNION ALL
  SELECT 'of-vegetarian-poutine',          'only-fries',                 'OF Vegetarian Poutine',          'Crispy fries with poutine-style seasoning, served plain.',                                                   6.99,         1,        7
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'fries-works'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description), long_description = VALUES(long_description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id),
  sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);
