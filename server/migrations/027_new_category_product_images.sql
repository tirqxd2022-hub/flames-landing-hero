-- Wire up product photos for the recently added categories
-- (Sandwich Corner, Snacks & Chaat, Fusion, Sweet Treat, Dosa).
-- All image files live in server/products/ and are tracked in the repo.

UPDATE products SET image_url = '/products/sandwich-cheese.jpg'                 WHERE slug = 'sandwich-cheese';
UPDATE products SET image_url = '/products/sandwich-egg-salad.jpg'              WHERE slug = 'sandwich-egg-salad';
UPDATE products SET image_url = '/products/sandwich-chicken-salad.jpg'          WHERE slug = 'sandwich-chicken-salad';
UPDATE products SET image_url = '/products/sandwich-tuna-salad.jpg'             WHERE slug = 'sandwich-tuna-salad';
UPDATE products SET image_url = '/products/sandwich-fish-jalapeno-coleslaw.jpg' WHERE slug = 'sandwich-fish-jalapeno-coleslaw';

UPDATE products SET image_url = '/products/snack-vege-samosa.jpg'      WHERE slug = 'snack-vege-samosa';
UPDATE products SET image_url = '/products/snack-vege-spring-roll.jpg' WHERE slug = 'snack-vege-spring-roll';
UPDATE products SET image_url = '/products/snack-vege-patties.jpg'     WHERE slug = 'snack-vege-patties';
UPDATE products SET image_url = '/products/snack-chicken-patties.jpg'  WHERE slug = 'snack-chicken-patties';
UPDATE products SET image_url = '/products/snack-paani-poori.jpg'      WHERE slug = 'snack-paani-poori';
UPDATE products SET image_url = '/products/snack-chaat-papri.jpg'      WHERE slug = 'snack-chaat-papri';
UPDATE products SET image_url = '/products/snack-samosa-chaat.jpg'     WHERE slug = 'snack-samosa-chaat';
UPDATE products SET image_url = '/products/snack-pav-bhaji-plate.jpg'  WHERE slug = 'snack-pav-bhaji-plate';

UPDATE products SET image_url = '/products/fusion-vege-tacos.jpg'           WHERE slug = 'fusion-vege-tacos';
UPDATE products SET image_url = '/products/fusion-butter-chicken-tacos.jpg' WHERE slug = 'fusion-butter-chicken-tacos';
UPDATE products SET image_url = '/products/fusion-shrimp-tacos.jpg'         WHERE slug = 'fusion-shrimp-tacos';
UPDATE products SET image_url = '/products/fusion-pizza-only-cheese.jpg'    WHERE slug = 'fusion-pizza-only-cheese';
UPDATE products SET image_url = '/products/fusion-pizza-vege-shakahari.jpg' WHERE slug = 'fusion-pizza-vege-shakahari';
UPDATE products SET image_url = '/products/fusion-pizza-hawaiin-vege.jpg'   WHERE slug = 'fusion-pizza-hawaiin-vege';
UPDATE products SET image_url = '/products/fusion-pizza-butter-chicken.jpg' WHERE slug = 'fusion-pizza-butter-chicken';

UPDATE products SET image_url = '/products/sweet-plain-vanilla.jpg'         WHERE slug = 'sweet-plain-vanilla';
UPDATE products SET image_url = '/products/sweet-mixed-fruit-cake.jpg'      WHERE slug = 'sweet-mixed-fruit-cake';
UPDATE products SET image_url = '/products/sweet-coconut-cake.jpg'          WHERE slug = 'sweet-coconut-cake';
UPDATE products SET image_url = '/products/sweet-carrot-cake.jpg'           WHERE slug = 'sweet-carrot-cake';
UPDATE products SET image_url = '/products/sweet-carrot-walnut-cake.jpg'    WHERE slug = 'sweet-carrot-walnut-cake';
UPDATE products SET image_url = '/products/sweet-gulab-jamun-2pc.jpg'       WHERE slug = 'sweet-gulab-jamun-2pc';
UPDATE products SET image_url = '/products/sweet-kheer-plain.jpg'           WHERE slug = 'sweet-kheer-plain';
UPDATE products SET image_url = '/products/sweet-kheer-nuts-raisins.jpg'    WHERE slug = 'sweet-kheer-nuts-raisins';
UPDATE products SET image_url = '/products/sweet-mixed-berry-cheese-cake.jpg' WHERE slug = 'sweet-mixed-berry-cheese-cake';
UPDATE products SET image_url = '/products/sweet-mango-cheese-cake.jpg'     WHERE slug = 'sweet-mango-cheese-cake';
UPDATE products SET image_url = '/products/sweet-mixed-berry-danish.jpg'    WHERE slug = 'sweet-mixed-berry-danish';
UPDATE products SET image_url = '/products/sweet-apple-cinnamon-danish.jpg' WHERE slug = 'sweet-apple-cinnamon-danish';

UPDATE products SET image_url = '/products/dosa-plain.jpg'           WHERE slug = 'dosa-plain';
UPDATE products SET image_url = '/products/dosa-mysore.jpg'          WHERE slug = 'dosa-mysore';
UPDATE products SET image_url = '/products/dosa-masala.jpg'          WHERE slug = 'dosa-masala';
UPDATE products SET image_url = '/products/dosa-mysore-masala.jpg'   WHERE slug = 'dosa-mysore-masala';
UPDATE products SET image_url = '/products/dosa-cheese.jpg'          WHERE slug = 'dosa-cheese';
UPDATE products SET image_url = '/products/dosa-cheese-masala.jpg'   WHERE slug = 'dosa-cheese-masala';
UPDATE products SET image_url = '/products/dosa-paneer-makhni.jpg'   WHERE slug = 'dosa-paneer-makhni';
UPDATE products SET image_url = '/products/dosa-egg.jpg'             WHERE slug = 'dosa-egg';
UPDATE products SET image_url = '/products/dosa-butter-chicken.jpg'  WHERE slug = 'dosa-butter-chicken';
UPDATE products SET image_url = '/products/dosa-chicken-egg.jpg'     WHERE slug = 'dosa-chicken-egg';
UPDATE products SET image_url = '/products/dosa-box-vegetarian.jpg'  WHERE slug = 'dosa-box-vegetarian';
UPDATE products SET image_url = '/products/dosa-box-non-veg.jpg'     WHERE slug = 'dosa-box-non-veg';
