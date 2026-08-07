-- Add is_featured flag to products for highlighting on the home "Our Menu" section
ALTER TABLE products
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0,
  ADD INDEX idx_products_is_featured (is_featured);
