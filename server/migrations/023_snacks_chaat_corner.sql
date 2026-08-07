-- New "Snacks & Chaat Corner" category with its food items.

INSERT INTO categories (slug, name, description, image_url, sort_order)
VALUES ('snacks-chaat-corner', 'Snacks & Chaat Corner', 'Crispy samosas, spicy chaats and street-style snacks.', '', 25)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order);

INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
SELECT t.slug, c.id, NULL, t.name, t.descr, t.descr, t.price, '', t.veg, 1, 5.0, t.so
FROM categories c
JOIN (
  SELECT 'snack-vege-samosa'           AS slug, 'Vege Samosa (3 pc)'              AS name, 'Crispy fried pastry filled with spiced potatoes and peas.' AS descr, 2.99 AS price, 1 AS veg, 0 AS so UNION ALL
  SELECT 'snack-vege-spring-roll',            'Vege Spring Roll (3 pc)',                 'Golden-fried spring rolls stuffed with seasoned vegetables.',     2.99,        1,        1 UNION ALL
  SELECT 'snack-vege-patties',                'Vege Patties',                            'Flaky baked patties with a savoury vegetable filling.',           3.99,        1,        2 UNION ALL
  SELECT 'snack-chicken-patties',             'Chicken Patties',                         'Flaky baked patties filled with spiced minced chicken.',          4.99,        0,        3 UNION ALL
  SELECT 'snack-paani-poori',                 'Paani Poori (5 pc)',                      'Crispy puris with tangy spiced water, chickpeas and potato.',     4.99,        1,        4 UNION ALL
  SELECT 'snack-chaat-papri',                 'Chaat Papri (1 Plate)',                   'Crispy papri layered with yogurt, chutneys and chickpeas.',       7.99,        1,        5 UNION ALL
  SELECT 'snack-samosa-chaat',                'Samosa Chaat (1 Plate)',                  'Crushed samosa topped with chana, yogurt and tangy chutneys.',    7.99,        1,        6 UNION ALL
  SELECT 'snack-pav-bhaji-plate',             'Pav Bhaji (1 Plate)',                     'Spiced mashed-vegetable bhaji served with buttered pavs.',        8.99,        1,        7
) t
WHERE c.slug = 'snacks-chaat-corner'
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price = VALUES(price), description = VALUES(description),
  category_id = VALUES(category_id), sort_order = VALUES(sort_order), is_veg = VALUES(is_veg);
