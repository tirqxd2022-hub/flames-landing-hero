-- SEO Tools: per-page SEO overrides table.
-- Sitemap, robots, verification tags, schema and cache settings are stored
-- in the existing key/value `site_settings` table.

CREATE TABLE IF NOT EXISTS page_seo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(220) NOT NULL UNIQUE,
  title VARCHAR(255) NULL,
  description VARCHAR(500) NULL,
  focus_keyword VARCHAR(160) NULL,
  og_image VARCHAR(500) NULL,
  json_ld TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
