-- ============================================================
-- Adds menu data: Drinks, Signature Dishes, Curries, and
-- two new Lunch subcategories (Rice Bowl, Lunch Combos).
-- Idempotent: re-running it updates existing rows in place.
-- ============================================================

-- ---------- 1. CATEGORIES ----------
INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES
  ('drinks',           'Drinks',           'Soft drinks, smoothies, hot beverages and water.', '/uploads/drinks-hero.jpg',     20),
  ('signature-dishes', 'Signature Dishes', 'Chef''s special signature plates.',                  '/uploads/signatures-hero.jpg', 21),
  ('curries',          'Curries',          'Curry items served in 24 oz portions.',             '/uploads/curries-hero.jpg',    22)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  image_url = VALUES(image_url), sort_order = VALUES(sort_order);

-- ---------- 2. SUBCATEGORIES ----------
-- Drinks
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order
FROM categories c
JOIN (
  SELECT 'cans'          AS slug, 'Cans'           AS name, 0 AS sort_order UNION ALL
  SELECT 'smoothies',         'Smoothies',         1 UNION ALL
  SELECT 'hot-beverages',     'Hot Beverages',     2 UNION ALL
  SELECT 'water',             'Water',             3
) x
WHERE c.slug = 'drinks'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- Lunch
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order FROM categories c
JOIN (
  SELECT 'rice-bowl'    AS slug, 'Rice Bowl'    AS name, 10 AS sort_order UNION ALL
  SELECT 'lunch-combos',       'Lunch Combos',       11
) x WHERE c.slug = 'lunch'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- Curries
INSERT INTO subcategories (category_id, slug, name, sort_order)
SELECT c.id, x.slug, x.name, x.sort_order FROM categories c
JOIN (
  SELECT 'vegetarian'    AS slug, 'Vegetarian'    AS name, 0 AS sort_order UNION ALL
  SELECT 'non-veg',            'Non Veg',            1 UNION ALL
  SELECT 'rice-festive',       'Rice Festive',       2 UNION ALL
  SELECT 'naan-bread',         'Naan / Bread',       3 UNION ALL
  SELECT 'sides',              'Sides',              4 UNION ALL
  SELECT 'party-trays-veg',    'Party Trays — Veg',  5 UNION ALL
  SELECT 'party-trays-nonveg', 'Party Trays — Non Veg', 6
) x WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- ---------- 3. PRODUCTS ----------
-- Helper note: image_url is left blank so the admin can upload exact Canadian
-- brand-label photos through the Media Picker for the soft-drink items.

-- ===== Drinks / Cans =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'cans'
JOIN (
  SELECT 'drink-coke'        AS slug, 'Coke'        AS name, 'Coca-Cola can (355 mL).'         AS descr, 1.99 AS price, 0 AS so UNION ALL
  SELECT 'drink-coke-zero',         'Coke Zero',        'Coca-Cola Zero Sugar can.',                    1.99, 1 UNION ALL
  SELECT 'drink-diet-coke',         'Diet Coke',        'Diet Coke can.',                                1.99, 2 UNION ALL
  SELECT 'drink-pepsi',             'Pepsi',            'Pepsi can.',                                    1.99, 3 UNION ALL
  SELECT 'drink-fanta',             'Fanta',            'Fanta orange can.',                             1.99, 4 UNION ALL
  SELECT 'drink-sprite',            'Sprite',           'Sprite can.',                                   1.99, 5 UNION ALL
  SELECT 'drink-dr-pepper',         'Dr. Pepper',       'Dr Pepper can.',                                1.99, 6 UNION ALL
  SELECT 'drink-canada-dry',        'Canada Dry',       'Canada Dry ginger ale can.',                    1.99, 7 UNION ALL
  SELECT 'drink-fuze',              'Fuze',             'Fuze iced tea.',                                1.99, 8
) t WHERE c.slug = 'drinks'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), description = VALUES(description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Drinks / Water =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'water'
JOIN (
  SELECT 'drink-eska-water'     AS slug, 'Eska Water'        AS name, 'Eska natural spring water.' AS descr, 1.99 AS price, 0 AS so UNION ALL
  SELECT 'drink-maison-perrier',        'Maison Perrier',          'Perrier sparkling water.',           2.49, 1 UNION ALL
  SELECT 'drink-vita-coconut-water',    'Vita Coconut Water',      'Vita coconut water.',                2.49, 2
) t WHERE c.slug = 'drinks'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), description = VALUES(description),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Drinks / Smoothies (sized — small / medium / large) =====
-- We expose each smoothie as a single product priced at the Small price so it
-- can also be billed as a standalone item. Size selection lives on the
-- Signature-dish addons further below.
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, CONCAT('Available in Small $4.99 / Medium $5.69 / Large $6.49.'), 4.99, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'smoothies'
JOIN (
  SELECT 'smoothie-mango-maza'      AS slug, 'Mango Maza'       AS name, 0 AS so UNION ALL
  SELECT 'smoothie-mango-banana',          'Mango Banana',           1 UNION ALL
  SELECT 'smoothie-strawberry',            'Strawberry',             2 UNION ALL
  SELECT 'smoothie-strawberry-banana',     'Strawberry Banana',      3 UNION ALL
  SELECT 'smoothie-mixed-berry',           'Mixed Berry',            4
) t WHERE c.slug = 'drinks'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Drinks / Hot Beverages =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'hot-beverages'
JOIN (
  SELECT 'hot-masala-chai' AS slug, 'Masala Chai' AS name, 'Small $2.99 / Medium $3.49 / Large $3.99.' AS descr, 2.99 AS price, 0 AS so UNION ALL
  SELECT 'hot-coffee',             'Coffee',            'Small $2.49 / Medium $2.99 / Large $3.49.',        2.49, 1 UNION ALL
  SELECT 'hot-plain-tea',          'Plain Tea',         'Small $1.99 / Medium $2.49 / Large $2.99.',        1.99, 2
) t WHERE c.slug = 'drinks'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Lunch / Rice Bowl =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, '', t.price, '', t.veg, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'rice-bowl'
JOIN (
  SELECT 'veg-rice-bowl'        AS slug, 'Veg Rice Bowl'        AS name, 0.00 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'nonveg-rice-bowl',           'Nonveg Rice Bowl',           0.00,        0,        1 UNION ALL
  SELECT 'veg-hakka-rice-bowl',        'Veg Hakka Rice Bowl',        0.00,        1,        2 UNION ALL
  SELECT 'nonveg-hakka-rice-bowl',     'Nonveg Hakka Rice Bowl',     0.00,        0,        3
) t WHERE c.slug = 'lunch'
ON DUPLICATE KEY UPDATE name = VALUES(name), is_veg = VALUES(is_veg),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Lunch / Lunch Combos =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, '', t.price, '', t.veg, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'lunch-combos'
JOIN (
  SELECT 'veg-lunch-combo'        AS slug, 'Veg Lunch Combo'        AS name, 0.00 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'nonveg-lunch-combo',            'Nonveg Lunch Combo',            0.00,        0,        1 UNION ALL
  SELECT 'veg-hakka-lunch-combo',         'Veg Hakka Lunch Combo',         0.00,        1,        2 UNION ALL
  SELECT 'nonveg-hakka-lunch-combo',      'Nonveg Hakka Lunch Combo',      0.00,        0,        3
) t WHERE c.slug = 'lunch'
ON DUPLICATE KEY UPDATE name = VALUES(name), is_veg = VALUES(is_veg),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Signature Dishes =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, sort_order)
SELECT t.slug, c.id, NULL, t.name, t.descr, t.descr, t.price, '', t.veg, t.active, t.so
FROM categories c
JOIN (
  SELECT 'sig-tandoori-chicken-leg' AS slug, 'Tandoori Chicken Leg' AS name, 'Served with Rice, Vege, Salad & Naan.' AS descr, 12.99 AS price, 0 AS veg, 1 AS active, 0 AS so UNION ALL
  SELECT 'sig-chutney-chicken-leg',         'Chutney Chicken Leg',         'Served with Rice and Veggies.',                   12.99,        0,        0,           1 UNION ALL
  SELECT 'sig-chicken-breast',              'Chicken Breast',              'Served with stuffed mushroom, vege and rice.',    14.99,        0,        1,           2 UNION ALL
  SELECT 'sig-fish-fry',                    'Fish Fry',                    'Served with Fries & Coleslaw.',                   12.49,        0,        0,           3 UNION ALL
  SELECT 'sig-baked-lemon-fish',            'Baked Lemon Fish',            'Served with Rice and lentil.',                    13.99,        0,        1,           4
) t WHERE c.slug = 'signature-dishes'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), long_description = VALUES(long_description),
  price = VALUES(price), is_veg = VALUES(is_veg), is_active = VALUES(is_active),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Vegetarian =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'vegetarian'
JOIN (
  SELECT 'curry-chana-masala'   AS slug, 'Chana Masala'        AS name, 'Chick peas cooked with onion, tomato, spices and herbs.'         AS descr, 13.99 AS price, 0 AS so UNION ALL
  SELECT 'curry-vegetable-jalfrezi',     'Vegetable Jalfrezi',         'Mixed vegetable cooked in aromatic curry gravy.',                       14.99, 1 UNION ALL
  SELECT 'curry-mater-paneer',           'Mater Paneer',               'Cottage cheese and green peas cooked with onion, tomato and spices.',   15.99, 2 UNION ALL
  SELECT 'curry-palak-paneer',           'Palak Paneer',               'Cottage cheese simmered in thick vibrant spinach puree.',               15.99, 3 UNION ALL
  SELECT 'curry-dal-makhni',             'Dal Makhni',                 'Mixed lentil cooked with rich, creamy and velvety sauce.',              14.99, 4 UNION ALL
  SELECT 'curry-aloo-gobi',              'Aloo Gobi',                  'Roasted Potatoes & Cauliflower cooked in onion-tomato gravy.',          14.99, 5 UNION ALL
  SELECT 'curry-aloo-mater',             'Aloo Mater',                 'Roasted Potatoes & green peas in onion-tomato gravy.',                  14.99, 6 UNION ALL
  SELECT 'curry-rajma',                  'Rajma',                      'Red Kidney beans simmered in spiced onion tomato gravy.',               13.99, 7 UNION ALL
  SELECT 'curry-vege-manchurian',        'Vege Manchurian',            'Mixed vege ball cooked in Manchurian sauce.',                           14.99, 8
) t WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Non Veg =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 0, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'non-veg'
JOIN (
  SELECT 'curry-flames-butter-chicken' AS slug, 'Flames Butter Chicken' AS name, 'Boneless crunchy chicken simmered in rich creamy sauce.'    AS descr, 16.99 AS price, 0 AS so UNION ALL
  SELECT 'curry-kadai-chicken',                'Kadai Chicken',                'Tender chicken in rich thick tomato masala with crisp peppers.',          14.99, 1 UNION ALL
  SELECT 'curry-chicken-tikka-masala',         'Chicken Tikka Masala',         'Tandoori grilled chicken with onions & peppers in spiced makhni sauce.',  15.99, 2 UNION ALL
  SELECT 'curry-chicken-korma',                'Chicken Korma',                'Tender chicken braised in a creamy, velvety sauce.',                      14.99, 3 UNION ALL
  SELECT 'curry-achari-chicken',               'Achari Chicken',               'Chicken cooked in robust tomato sauce blended with pickling spices.',     14.99, 4 UNION ALL
  SELECT 'curry-chicken-vindaloo',             'Chicken Vindaloo',             'Chicken marinated in vinegar, garlic and red chillies — Flames specialty.',14.99, 5 UNION ALL
  SELECT 'curry-chicken-curry',                'Chicken Curry',                'Tender chicken stewed in a rich spice sauce.',                            14.99, 6 UNION ALL
  SELECT 'curry-chilli-chicken',               'Chilli Chicken',               'Hakka style Chilli chicken.',                                              15.99, 7 UNION ALL
  SELECT 'curry-chicken-manchurian',           'Chicken Manchurian',           'Crispy fried chicken cooked in Manchurian sauce.',                        15.99, 8
) t WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Rice Festive =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', t.veg, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'rice-festive'
JOIN (
  SELECT 'rice-chicken-dum-biryani' AS slug, 'Chicken Dum Biryani' AS name, 'Kolkata-style Biryani served with potato, egg and two pieces of chicken with fragrance of whole spices, saffron and ghee.' AS descr, 16.99 AS price, 0 AS veg, 0 AS so UNION ALL
  SELECT 'rice-basmati-pulao',             'Basmati Pulao',             'Basmati rice cooked with fragrance of whole spices, saffron and ghee.',                                     9.99, 1, 1 UNION ALL
  SELECT 'rice-veg-fried-rice',            'Veg Fried Rice',            'Hakka-style vege Fried Rice.',                                                                              14.99, 1, 2 UNION ALL
  SELECT 'rice-jeera-rice',                'Jeera Rice',                'Basmati rice cooked with fragrance of roasted cumin seed.',                                                 9.99, 1, 3
) t WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price), is_veg = VALUES(is_veg),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Naan / Bread =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, t.descr, t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'naan-bread'
JOIN (
  SELECT 'naan-plain'  AS slug, 'Plain Naan'  AS name, 'Tandoor baked light bread.'                                  AS descr, 1.99 AS price, 0 AS so UNION ALL
  SELECT 'naan-butter',       'Butter Naan',       'Buttered Tandoor baked light bread.',                                  2.99, 1 UNION ALL
  SELECT 'naan-garlic',       'Garlic Naan',       'Buttered Tandoor baked light bread flavoured with garlic.',            3.99, 2
) t WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Sides =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, '', t.price, '', 1, t.so
FROM categories c JOIN subcategories s ON s.category_id = c.id AND s.slug = 'sides'
JOIN (
  SELECT 'side-cucumber-raita' AS slug, 'Cucumber Raita' AS name, 1.99 AS price, 0 AS so UNION ALL
  SELECT 'side-onion-salad',          'Onion Salad',           3.99, 1
) t WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);

-- ===== Curries / Party Trays (Veg & Non-Veg) =====
INSERT INTO products (slug, category_id, subcategory_id, name, description, price, image_url, is_veg, sort_order)
SELECT t.slug, c.id, s.id, t.name, '', t.price, '', t.veg, t.so
FROM categories c
JOIN (
  SELECT 'party-veg-half'    AS slug, 'party-trays-veg'    AS sub, 'Veg Party Tray — Half'    AS name,  69.99 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'party-veg-medium',         'party-trays-veg',          'Veg Party Tray — Medium',         99.99,        1,        1 UNION ALL
  SELECT 'party-veg-full',           'party-trays-veg',          'Veg Party Tray — Full',          199.99,        1,        2 UNION ALL
  SELECT 'party-nonveg-half',        'party-trays-nonveg',       'Non-Veg Party Tray — Half',       69.99,        0,        3 UNION ALL
  SELECT 'party-nonveg-medium',      'party-trays-nonveg',       'Non-Veg Party Tray — Medium',     99.99,        0,        4 UNION ALL
  SELECT 'party-nonveg-full',        'party-trays-nonveg',       'Non-Veg Party Tray — Full',      199.99,        0,        5
) t
JOIN subcategories s ON s.category_id = c.id AND s.slug = t.sub
WHERE c.slug = 'curries'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), is_veg = VALUES(is_veg),
  category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order);


-- ---------- 4. SIGNATURE DISH ADDONS ----------
-- Each Signature dish offers an "Add a drink" set with Hot Beverages and
-- Smoothies, sized Small / Medium / Large (prices match the menu card).
-- Idempotent: wipe and recreate addon groups for these five products.

DELETE ag FROM addon_groups ag
JOIN products p ON p.id = ag.product_id
WHERE p.slug IN (
  'sig-tandoori-chicken-leg','sig-chutney-chicken-leg',
  'sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish'
);

-- Inline procedure-less seeding using a temp table of (slug, option name, prices).
-- Hot Beverages
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT p.id, 'Hot Beverages', 'multi', 0, 1, 0
FROM products p
WHERE p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

-- Smoothies
INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
SELECT p.id, 'Smoothies', 'multi', 0, 1, 1
FROM products p
WHERE p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

-- Hot Beverage options + sizes (Masala Chai, Coffee, Plain Tea)
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT ag.id, n.name, 0, n.so
FROM addon_groups ag
JOIN products p ON p.id = ag.product_id
JOIN (
  SELECT 'Masala Chai' AS name, 0 AS so UNION ALL
  SELECT 'Coffee', 1 UNION ALL
  SELECT 'Plain Tea', 2
) n
WHERE ag.name = 'Hot Beverages'
  AND p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order)
SELECT o.id, sz.slug, sz.name, sz.price, sz.so
FROM addon_options o
JOIN addon_groups ag ON ag.id = o.group_id AND ag.name = 'Hot Beverages'
JOIN products p ON p.id = ag.product_id
JOIN (
  SELECT 'Masala Chai' AS opt, 's' AS slug, 'Small'  AS name, 2.99 AS price, 0 AS so UNION ALL
  SELECT 'Masala Chai',          'm',         'Medium',         3.49,        1 UNION ALL
  SELECT 'Masala Chai',          'l',         'Large',          3.99,        2 UNION ALL
  SELECT 'Coffee',               's',         'Small',          2.49,        0 UNION ALL
  SELECT 'Coffee',               'm',         'Medium',         2.99,        1 UNION ALL
  SELECT 'Coffee',               'l',         'Large',          3.49,        2 UNION ALL
  SELECT 'Plain Tea',            's',         'Small',          1.99,        0 UNION ALL
  SELECT 'Plain Tea',            'm',         'Medium',         2.49,        1 UNION ALL
  SELECT 'Plain Tea',            'l',         'Large',          2.99,        2
) sz ON sz.opt = o.name
WHERE p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

-- Smoothie options + sizes (Strawberry, Mango, Mixed Berry) — all $4.99/$5.69/$6.49
INSERT INTO addon_options (group_id, name, price, sort_order)
SELECT ag.id, n.name, 0, n.so
FROM addon_groups ag
JOIN products p ON p.id = ag.product_id
JOIN (
  SELECT 'Strawberry'  AS name, 0 AS so UNION ALL
  SELECT 'Mango',              1 UNION ALL
  SELECT 'Mixed Berry',        2
) n
WHERE ag.name = 'Smoothies'
  AND p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order)
SELECT o.id, sz.slug, sz.name, sz.price, sz.so
FROM addon_options o
JOIN addon_groups ag ON ag.id = o.group_id AND ag.name = 'Smoothies'
JOIN products p ON p.id = ag.product_id
JOIN (
  SELECT 's' AS slug, 'Small'  AS name, 4.99 AS price, 0 AS so UNION ALL
  SELECT 'm',         'Medium',         5.69,        1 UNION ALL
  SELECT 'l',         'Large',          6.49,        2
) sz
WHERE p.slug IN ('sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish');

-- ============================================================
-- 5. PRODUCT IMAGES — point each new product at its generated photo
-- ============================================================
-- Filenames live in /products/ (served by .htaccess from ~/flames-api/products/).
-- Re-running is safe; UPDATEs are idempotent.

UPDATE products SET image_url = CASE slug
  -- Signature dishes
  WHEN 'sig-tandoori-chicken-leg'  THEN '/products/sig-tandoori-chicken-leg.jpg'
  WHEN 'sig-chutney-chicken-leg'   THEN '/products/sig-chutney-chicken-leg.jpg'
  WHEN 'sig-chicken-breast'        THEN '/products/sig-chicken-breast.jpg'
  WHEN 'sig-fish-fry'              THEN '/products/sig-fish-fry.jpg'
  WHEN 'sig-baked-lemon-fish'      THEN '/products/sig-baked-lemon-fish.jpg'
  -- Curries — Non Veg
  WHEN 'curry-flames-butter-chicken'  THEN '/products/curry-flames-butter-chicken.jpg'
  WHEN 'curry-kadai-chicken'          THEN '/products/curry-kadai-chicken.jpg'
  WHEN 'curry-chicken-tikka-masala'   THEN '/products/curry-chicken-tikka-masala.jpg'
  WHEN 'curry-chicken-korma'          THEN '/products/curry-chicken-korma.jpg'
  WHEN 'curry-achari-chicken'         THEN '/products/curry-achari-chicken.jpg'
  WHEN 'curry-chicken-vindaloo'       THEN '/products/curry-chicken-vindaloo.jpg'
  WHEN 'curry-chicken-curry'          THEN '/products/curry-chicken-curry.jpg'
  WHEN 'curry-chilli-chicken'         THEN '/products/curry-chilli-chicken.jpg'
  WHEN 'curry-chicken-manchurian'     THEN '/products/curry-chicken-manchurian.jpg'
  -- Curries — Vegetarian
  WHEN 'curry-chana-masala'        THEN '/products/curry-chana-masala.jpg'
  WHEN 'curry-vegetable-jalfrezi'  THEN '/products/curry-vegetable-jalfrezi.jpg'
  WHEN 'curry-mater-paneer'        THEN '/products/curry-mater-paneer.jpg'
  WHEN 'curry-palak-paneer'        THEN '/products/curry-palak-paneer.jpg'
  WHEN 'curry-dal-makhni'          THEN '/products/curry-dal-makhni.jpg'
  WHEN 'curry-aloo-gobi'           THEN '/products/curry-aloo-gobi.jpg'
  WHEN 'curry-aloo-mater'          THEN '/products/curry-aloo-mater.jpg'
  WHEN 'curry-rajma'               THEN '/products/curry-rajma.jpg'
  WHEN 'curry-vege-manchurian'     THEN '/products/curry-vege-manchurian.jpg'
  -- Rice Festive
  WHEN 'rice-chicken-dum-biryani'  THEN '/products/rice-chicken-dum-biryani.jpg'
  WHEN 'rice-basmati-pulao'        THEN '/products/rice-basmati-pulao.jpg'
  WHEN 'rice-veg-fried-rice'       THEN '/products/rice-veg-fried-rice.jpg'
  WHEN 'rice-jeera-rice'           THEN '/products/rice-jeera-rice.jpg'
  -- Naan / Sides
  WHEN 'naan-plain'                THEN '/products/naan-plain.jpg'
  WHEN 'naan-butter'               THEN '/products/naan-butter.jpg'
  WHEN 'naan-garlic'               THEN '/products/naan-garlic.jpg'
  WHEN 'side-cucumber-raita'       THEN '/products/side-cucumber-raita.jpg'
  WHEN 'side-onion-salad'          THEN '/products/side-onion-salad.jpg'
  -- Party Trays
  WHEN 'party-veg-half'            THEN '/products/party-veg-half.jpg'
  WHEN 'party-veg-medium'          THEN '/products/party-veg-medium.jpg'
  WHEN 'party-veg-full'            THEN '/products/party-veg-full.jpg'
  WHEN 'party-nonveg-half'         THEN '/products/party-nonveg-half.jpg'
  WHEN 'party-nonveg-medium'       THEN '/products/party-nonveg-medium.jpg'
  WHEN 'party-nonveg-full'         THEN '/products/party-nonveg-full.jpg'
  -- Smoothies
  WHEN 'smoothie-mango-maza'        THEN '/products/smoothie-mango-maza.jpg'
  WHEN 'smoothie-mango-banana'      THEN '/products/smoothie-mango-banana.jpg'
  WHEN 'smoothie-strawberry'        THEN '/products/smoothie-strawberry.jpg'
  WHEN 'smoothie-strawberry-banana' THEN '/products/smoothie-strawberry-banana.jpg'
  WHEN 'smoothie-mixed-berry'       THEN '/products/smoothie-mixed-berry.jpg'
  -- Hot Beverages
  WHEN 'hot-masala-chai'           THEN '/products/hot-masala-chai.jpg'
  WHEN 'hot-coffee'                THEN '/products/hot-coffee.jpg'
  WHEN 'hot-plain-tea'             THEN '/products/hot-plain-tea.jpg'
  -- Rice Bowls
  WHEN 'veg-rice-bowl'             THEN '/products/veg-rice-bowl.jpg'
  WHEN 'nonveg-rice-bowl'          THEN '/products/nonveg-rice-bowl.jpg'
  WHEN 'veg-hakka-rice-bowl'       THEN '/products/veg-hakka-rice-bowl.jpg'
  WHEN 'nonveg-hakka-rice-bowl'    THEN '/products/nonveg-hakka-rice-bowl.jpg'
  -- Lunch Combos
  WHEN 'veg-lunch-combo'           THEN '/products/veg-lunch-combo.jpg'
  WHEN 'nonveg-lunch-combo'        THEN '/products/nonveg-lunch-combo.jpg'
  WHEN 'veg-hakka-lunch-combo'     THEN '/products/veg-hakka-lunch-combo.jpg'
  WHEN 'nonveg-hakka-lunch-combo'  THEN '/products/nonveg-hakka-lunch-combo.jpg'
  -- Drinks — Cans
  WHEN 'drink-coke'                THEN '/products/drink-coke.jpg'
  WHEN 'drink-coke-zero'           THEN '/products/drink-coke-zero.jpg'
  WHEN 'drink-diet-coke'           THEN '/products/drink-diet-coke.jpg'
  WHEN 'drink-pepsi'               THEN '/products/drink-pepsi.jpg'
  WHEN 'drink-fanta'               THEN '/products/drink-fanta.jpg'
  WHEN 'drink-sprite'              THEN '/products/drink-sprite.jpg'
  WHEN 'drink-dr-pepper'           THEN '/products/drink-dr-pepper.jpg'
  WHEN 'drink-canada-dry'          THEN '/products/drink-canada-dry.jpg'
  WHEN 'drink-fuze'                THEN '/products/drink-fuze.jpg'
  -- Drinks — Water
  WHEN 'drink-eska-water'          THEN '/products/drink-eska-water.jpg'
  WHEN 'drink-maison-perrier'      THEN '/products/drink-maison-perrier.jpg'
  WHEN 'drink-vita-coconut-water'  THEN '/products/drink-vita-coconut-water.jpg'
  ELSE image_url
END
WHERE slug IN (
  'sig-tandoori-chicken-leg','sig-chutney-chicken-leg','sig-chicken-breast','sig-fish-fry','sig-baked-lemon-fish',
  'curry-flames-butter-chicken','curry-kadai-chicken','curry-chicken-tikka-masala','curry-chicken-korma',
  'curry-achari-chicken','curry-chicken-vindaloo','curry-chicken-curry','curry-chilli-chicken','curry-chicken-manchurian',
  'curry-chana-masala','curry-vegetable-jalfrezi','curry-mater-paneer','curry-palak-paneer','curry-dal-makhni',
  'curry-aloo-gobi','curry-aloo-mater','curry-rajma','curry-vege-manchurian',
  'rice-chicken-dum-biryani','rice-basmati-pulao','rice-veg-fried-rice','rice-jeera-rice',
  'naan-plain','naan-butter','naan-garlic','side-cucumber-raita','side-onion-salad',
  'party-veg-half','party-veg-medium','party-veg-full','party-nonveg-half','party-nonveg-medium','party-nonveg-full',
  'smoothie-mango-maza','smoothie-mango-banana','smoothie-strawberry','smoothie-strawberry-banana','smoothie-mixed-berry',
  'hot-masala-chai','hot-coffee','hot-plain-tea',
  'veg-rice-bowl','nonveg-rice-bowl','veg-hakka-rice-bowl','nonveg-hakka-rice-bowl',
  'veg-lunch-combo','nonveg-lunch-combo','veg-hakka-lunch-combo','nonveg-hakka-lunch-combo',
  'drink-coke','drink-coke-zero','drink-diet-coke','drink-pepsi','drink-fanta','drink-sprite',
  'drink-dr-pepper','drink-canada-dry','drink-fuze',
  'drink-eska-water','drink-maison-perrier','drink-vita-coconut-water'
);
