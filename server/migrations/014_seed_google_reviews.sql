-- Seed additional customer reviews captured from the Google Business profile.
-- Idempotent: skips rows whose name+quote already exist.
INSERT INTO reviews (name, role, quote, rating, sort_order)
SELECT * FROM (
  SELECT 'Jaime Cunha-Nemecsek' AS name, 'Local Guide' AS role,
    'Amazing food and great customer service. Definitely be visiting again soon.' AS quote,
    5 AS rating, 4 AS sort_order
  UNION ALL SELECT 'Pepe', 'Google Review',
    'Amazing food, great price, incredible staff/owners.', 5, 5
  UNION ALL SELECT 'Farva F', 'Google Review',
    'Amazing service, amazing folks! Lots of breakfast and lunch options.', 5, 6
  UNION ALL SELECT 'Sal S', 'Local Guide',
    'Martha and John are very kind. It''s a family run business, making the service very tailored and personal. Had the chai and look forward to trying more things :)', 5, 7
  UNION ALL SELECT 'Rohan Kurella', 'Google Review',
    'Food was amazing! Best customer service!!!', 5, 8
  UNION ALL SELECT 'Peter F', 'Local Guide',
    'Amazing food at an amazing price.', 5, 9
  UNION ALL SELECT 'Karan', 'Google Review',
    'Drinks are amazing here, especially Mango Lassi!', 5, 10
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r WHERE r.name = seed.name AND r.quote = seed.quote
);
