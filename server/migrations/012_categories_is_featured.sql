-- Add is_featured flag to categories for highlighting on the home "Our Cuisine" section
ALTER TABLE categories
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0,
  ADD INDEX idx_categories_is_featured (is_featured);
