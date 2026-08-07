-- Set hero (image_url) for the four new categories.
-- Hero/page images live under /uploads/ (server/uploads/) alongside the
-- other category hero banners.
UPDATE categories SET image_url = '/uploads/category-snacks-chaat-corner.jpg' WHERE slug = 'snacks-chaat-corner';
UPDATE categories SET image_url = '/uploads/category-fusion.jpg'              WHERE slug = 'fusion';
UPDATE categories SET image_url = '/uploads/category-sweet-treat.jpg'         WHERE slug = 'sweet-treat';
UPDATE categories SET image_url = '/uploads/category-dosa.jpg'                WHERE slug = 'dosa';
