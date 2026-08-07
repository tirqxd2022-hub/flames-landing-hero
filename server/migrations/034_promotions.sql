-- Promotions: scheduled image slideshow campaigns shown on /promotions.

CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  -- CSV of weekday numbers 0-6 (Sun..Sat). Empty/NULL = every day.
  days_of_week VARCHAR(20) DEFAULT NULL,
  date_start DATE DEFAULT NULL,
  date_end DATE DEFAULT NULL,
  time_start TIME DEFAULT NULL,
  time_end TIME DEFAULT NULL,
  slide_duration_ms INT NOT NULL DEFAULT 5000,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_slides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
