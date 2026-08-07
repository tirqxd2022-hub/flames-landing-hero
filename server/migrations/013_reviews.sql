-- Customer reviews / testimonials shown on the Home page.
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(160) NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  avatar_url VARCHAR(500) NOT NULL DEFAULT '',
  rating TINYINT NOT NULL DEFAULT 5,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reviews_active (is_active),
  INDEX idx_reviews_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed a few starter reviews so the Home section isn't empty on first deploy.
INSERT INTO reviews (name, role, quote, rating, sort_order) VALUES
  ('Michael Anderson', 'Regular Customer', 'Fresh ingredients, rich flavors and quick service. The restaurant delivers quality consistently and never disappoints.', 5, 1),
  ('Priya Sharma', 'Food Blogger', 'Hands down the most authentic Indian flavors I''ve had in Canada. The biryani is unreal.', 5, 2),
  ('Jonathan Lee', 'Office Lunch Regular', 'My go-to lunch spot. The thali boxes are generous, fresh and packed with flavor every time.', 5, 3);
