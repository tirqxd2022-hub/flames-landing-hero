-- New "Packaged Food" category for jarred home-made products (pickles, jams,
-- sauces, etc.) plus an optional nutrition_json column on products.

INSERT INTO categories (slug, name, description, image_url, sort_order)
SELECT 'packaged-food', 'Packaged Food',
       'Home-made jarred pickles, jams, sauces and more.', '', 30
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'packaged-food');

-- Optional nutrition facts (stored as JSON string). NULL/empty means "hide".
ALTER TABLE products
  ADD COLUMN nutrition_json TEXT NULL AFTER long_description;
