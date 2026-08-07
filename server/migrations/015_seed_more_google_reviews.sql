-- Two more Google reviews.
INSERT INTO reviews (name, role, quote, rating, sort_order)
SELECT * FROM (
  SELECT 'Uma Gundi' AS name, 'Google Review' AS role,
    'Lovely family run business! Affordable and tasty.' AS quote,
    5 AS rating, 11 AS sort_order
  UNION ALL SELECT 'Afra Afifa', 'Google Review',
    'Amazing service, food is SO GOOD! and AFFORDABLE!!', 5, 12
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r WHERE r.name = seed.name AND r.quote = seed.quote
);
