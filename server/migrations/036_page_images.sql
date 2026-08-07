-- Page image overrides: maps a stable slot key (e.g. "home.hero.video") to an
-- image/video URL chosen from the admin Page Images screen. Pages render the
-- override when present, otherwise fall back to the hardcoded default in the
-- frontend registry. Same default URL used in multiple slots stays
-- independently replaceable because the key is unique per slot.
CREATE TABLE IF NOT EXISTS page_images (
  slot_key VARCHAR(120) NOT NULL PRIMARY KEY,
  image_url VARCHAR(1000) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
