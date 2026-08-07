-- Create new "Rice & Bread" category and move the "Rice Festive" and
-- "Naan / Bread" subcategories (with all their products) over from "Curries".

INSERT INTO categories (slug, name, description, image_url, sort_order)
SELECT 'rice-and-bread', 'Rice & Bread', 'Festive rice and freshly baked breads.', '', 23
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'rice-and-bread');

-- Move the subcategories (subcategories.slug is unique per category, so the
-- target slugs are guaranteed free on the new category).
UPDATE subcategories s
JOIN categories newc ON newc.slug = 'rice-and-bread'
JOIN categories oldc ON oldc.slug = 'curries'
SET s.category_id = newc.id
WHERE s.category_id = oldc.id
  AND s.slug IN ('rice-festive', 'naan-bread');

-- Re-home every product currently tied to those subcategories so they belong
-- to the new parent category as well.
UPDATE products p
JOIN subcategories s ON s.id = p.subcategory_id
JOIN categories newc ON newc.slug = 'rice-and-bread'
SET p.category_id = newc.id
WHERE s.slug IN ('rice-festive', 'naan-bread');
