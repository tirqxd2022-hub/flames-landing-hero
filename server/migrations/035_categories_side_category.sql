-- Add an optional "side category" pointer on each category. Used to drive the
-- upsell carousel ("side dishes") on the Cart and Checkout pages: for every
-- item in the cart, products from the parent category's side_category_id are
-- recommended.
ALTER TABLE categories
  ADD COLUMN side_category_id INT NULL AFTER is_featured,
  ADD CONSTRAINT fk_categories_side_category
    FOREIGN KEY (side_category_id) REFERENCES categories(id) ON DELETE SET NULL;
