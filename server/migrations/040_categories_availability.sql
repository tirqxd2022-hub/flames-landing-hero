-- Add availability state for categories: available (default) | unavailable | upcoming
ALTER TABLE categories
  ADD COLUMN availability ENUM('available','unavailable','upcoming') NOT NULL DEFAULT 'available';
