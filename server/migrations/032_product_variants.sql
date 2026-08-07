-- Variable product support. Existing products remain `simple` by default.

ALTER TABLE products
  ADD COLUMN product_type ENUM('simple','variable') NOT NULL DEFAULT 'simple';

CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(8,2) NOT NULL DEFAULT 0,
  is_base TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_pv_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
