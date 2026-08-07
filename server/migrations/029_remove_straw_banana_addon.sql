-- Remove the stray "Straw Banana" addon option that was added to
-- Smoothies groups via the admin UI but is not part of the seeded menu.
-- IMPORTANT: do NOT touch "Strawberry Banana" — that is a valid option.
-- Cascade deletes its sizes via addon_option_sizes FK.

DELETE o FROM addon_options o
JOIN addon_groups g ON g.id = o.group_id
WHERE g.name = 'Smoothies'
  AND o.name = 'Straw Banana';

