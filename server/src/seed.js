import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const categories = [
  { slug: "breakfast", name: "Breakfast", description: "Hearty breakfast plates." },
  { slug: "lunch", name: "Lunch", description: "Quick midday meals." },
  { slug: "appetizers", name: "Appetizers", description: "Crispy, spicy starters." },
  { slug: "dinner", name: "Dinner", description: "Curries, tandoors and biryanis." },
];

const subcategories = [
  { catSlug: "breakfast", slug: "scrambled-egg", name: "SCRAMBLED EGG (3 EGGS)" },
  { catSlug: "breakfast", slug: "omelette", name: "OMELETTE (3 EGGS)" },
  { catSlug: "breakfast", slug: "bagel-sandwich", name: "Bagel Sandwich" },
  { catSlug: "breakfast", slug: "pan-cakes", name: "PAN CAKES (3 pc)" },
  { catSlug: "breakfast", slug: "pav-bhaji", name: "Pav Bhaji" },
];

const products = [
  // Breakfast / Scrambled
  { slug: "egg-bhurji-indian-style", cat: "breakfast", sub: "scrambled-egg", name: "Egg Bhurji Indian Style", price: 9.99, veg: 0, desc: "Onion, green chilies and coriander. Served with Toast, Home Fries and Dessert." },
  { slug: "vege-shakahari-scrambled-egg", cat: "breakfast", sub: "scrambled-egg", name: "Vege Shakahari Scrambled Egg", price: 9.99, veg: 0, desc: "Onion, mixed bell peppers and tomato. Served with Toast, Home Fries and Dessert." },
  { slug: "only-egg-scramble", cat: "breakfast", sub: "scrambled-egg", name: "Only Egg Scramble", price: 7.99, veg: 0, desc: "Plain scrambled egg. Served with Toast, Home Fries and Dessert." },
  // Breakfast / Omelette
  { slug: "vege-shakahari-omelette", cat: "breakfast", sub: "omelette", name: "VEGE SHAKAHARI", price: 9.99, veg: 0, desc: "Onion, mixed bell peppers and tomato." },
  { slug: "flames-indian-style-omelette", cat: "breakfast", sub: "omelette", name: "FLAMES INDIAN STYLE", price: 9.99, veg: 0, desc: "Onion and green chilli." },
  { slug: "all-cheesey-omelette", cat: "breakfast", sub: "omelette", name: "ALL CHEESEY", price: 9.99, veg: 0, desc: "Omelette rolled with cheddar cheese." },
  { slug: "plain-omlette", cat: "breakfast", sub: "omelette", name: "PLAIN OMLETTE", price: 7.99, veg: 0, desc: "Plain omelette." },
  // Breakfast / Bagel Sandwich
  { slug: "tuna-salad-sandwich", cat: "breakfast", sub: "bagel-sandwich", name: "Tuna w lettuce & tomato", price: 9.99, veg: 0, desc: "Tuna with lettuce and tomato on bagel." },
  { slug: "chicken-salad-sandwich", cat: "breakfast", sub: "bagel-sandwich", name: "Chicken Salad w lettuce & tomato", price: 8.99, veg: 0, desc: "Chicken salad with lettuce and tomato on bagel." },
  { slug: "egg-cheese-sandwich", cat: "breakfast", sub: "bagel-sandwich", name: "Egg and Cheese", price: 7.99, veg: 0, desc: "Egg and cheese bagel sandwich." },
  // Breakfast / Pancakes
  { slug: "pan-cakes-3pc", cat: "breakfast", sub: "pan-cakes", name: "PAN CAKES (3 pc)", price: 8.99, veg: 1, desc: "Topped with fresh fruits: strawberry, banana, blueberries with choice of maple, strawberry or chocolate syrup." },
  // Breakfast / Pav Bhaji
  { slug: "pav-bhaji", cat: "breakfast", sub: "pav-bhaji", name: "Pav Bhaji", price: 8.99, veg: 1, desc: "Served with two pavs and bhaji." },
];

const productImages = {
  "egg-bhurji-indian-style": "/products/egg-bhurji-indian-style.jpeg",
  "vege-shakahari-scrambled-egg": "/products/vege-shakahari-scrambled-egg.jpeg",
  "only-egg-scramble": "/products/plain-scrambled-egg.jpeg",
  "vege-shakahari-omelette": "/products/vege-shakahari-omelette.jpeg",
  "flames-indian-style-omelette": "/products/flames-indian-style-omelette.jpeg",
  "all-cheesey-omelette": "/products/all-cheesey-omelette.jpeg",
  "plain-omlette": "/products/plain-omelette.jpeg",
  "tuna-salad-sandwich": "/products/tuna-salad-sandwich.jpg",
  "chicken-salad-sandwich": "/products/chicken-salad-sandwich.jpg",
  "egg-cheese-sandwich": "/products/egg-cheese-sandwich.jpeg",
  "pan-cakes-3pc": "/products/pan-cakes-3pc.jpeg",
  "pav-bhaji": "/products/pav-bhaji.jpg",
};

// Default à-la-carte groups attached to every Breakfast product.
// Hot Beverages and Smoothies use size-based pricing (Small/Medium/Large).
const SIZES = [
  { slug: "s", name: "Small" },
  { slug: "m", name: "Medium" },
  { slug: "l", name: "Large" },
];

const breakfastAddons = [
  { name: "Choice of Bread", type: "single", required: 1, sized: 0, options: [
    { name: "White Bread", price: 0 }, { name: "Whole Wheat Bread", price: 0 },
  ]},
  { name: "Hot Beverages", type: "multi", required: 0, sized: 1, options: [
    { name: "Masala Chai", price: 0, sizes: { s: 2.99, m: 3.49, l: 3.99 } },
    { name: "Coffee",       price: 0, sizes: { s: 2.49, m: 2.99, l: 3.49 } },
    { name: "Plain Tea",    price: 0, sizes: { s: 1.99, m: 2.49, l: 2.99 } },
  ]},
  { name: "Smoothies", type: "multi", required: 0, sized: 1, options: [
    { name: "Strawberry",   price: 0, sizes: { s: 4.99, m: 5.69, l: 6.49 } },
    { name: "Mango",        price: 0, sizes: { s: 4.99, m: 5.69, l: 6.49 } },
    
  ]},
];

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const pwd = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !pwd) throw new Error("ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD missing in .env");

  // Legacy admins table (kept for backwards compatibility).
  // IMPORTANT: only insert if missing — never overwrite an existing password
  // hash. Use reset-admin.js if you need to change the password.
  await pool.query(
    `INSERT IGNORE INTO admins (email, password_hash, name) VALUES (?,?, 'Owner')`,
    [email, await bcrypt.hash(pwd, 10)]
  );

  // Super admin in admin_users (new RBAC table). Same rule: do not overwrite.
  const username = (email.split("@")[0] || "owner").replace(/[^a-zA-Z0-9_.-]+/g, "").slice(0, 64) || "owner";
  await pool.query(
    `INSERT IGNORE INTO admin_users (username, email, password_hash, is_super, role)
       VALUES (?, ?, ?, 1, 'admin')`,
    [username, email, await bcrypt.hash(pwd, 12)],
  );

  // Default site settings (only inserted if missing).
  const defaults = {
    site_title: "Flames Gourmet",
    site_tagline: "Authentic Indian flavors",
    logo_url: "/uploads/flames-logo.png",
    favicon_url: "/uploads/favicon.png",
    announcement_text: "",
    contact_email: "hello@flamesgourmet.ca",
    contact_phone: "",
    contact_whatsapp: "",
    contact_address: "",
    business_legal_name: "Flames Gourmet Inc.",
    gst_number: "",
    gst_rate_percent: "13",
    hsn_code: "",
    social_instagram: "",
    social_facebook: "",
    social_pinterest: "",
    social_youtube: "",
  };
  for (const [k, v] of Object.entries(defaults)) {
    await pool.query(`INSERT IGNORE INTO site_settings (k, v) VALUES (?, ?)`, [k, v]);
  }

  for (const [i, c] of categories.entries()) {
    await pool.query(
      `INSERT INTO categories (slug, name, description, sort_order) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order)`,
      [c.slug, c.name, c.description, i]
    );
  }

  for (const [i, s] of subcategories.entries()) {
    const [c] = await pool.query(`SELECT id FROM categories WHERE slug = ?`, [s.catSlug]);
    if (!c[0]) continue;
    await pool.query(
      `INSERT INTO subcategories (category_id, slug, name, sort_order) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)`,
      [c[0].id, s.slug, s.name, i]
    );
  }

  for (const [i, p] of products.entries()) {
    const [c] = await pool.query(`SELECT id FROM categories WHERE slug = ?`, [p.cat]);
    if (!c[0]) continue;
    let subId = null;
    if (p.sub) {
      const [s] = await pool.query(
        `SELECT id FROM subcategories WHERE category_id = ? AND slug = ?`,
        [c[0].id, p.sub]
      );
      subId = s[0]?.id ?? null;
    }
    const defaultImage = productImages[p.slug] || `/products/${p.slug}.jpg`;
    await pool.query(
      `INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,1,4.8,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), description = VALUES(description),
         category_id = VALUES(category_id), subcategory_id = VALUES(subcategory_id), sort_order = VALUES(sort_order),
         image_url = CASE WHEN image_url IS NULL OR image_url = '' THEN VALUES(image_url) ELSE image_url END`,
      [p.slug, c[0].id, subId, p.name, p.desc, p.desc, p.price, defaultImage, p.veg, i]
    );

    if (p.cat === "breakfast") {
      const [prod] = await pool.query(`SELECT id FROM products WHERE slug = ?`, [p.slug]);
      const productId = prod[0].id;
      // wipe existing addons for idempotent re-seed
      await pool.query(`DELETE FROM addon_groups WHERE product_id = ?`, [productId]);
      for (const [gi, g] of breakfastAddons.entries()) {
        const [gRes] = await pool.query(
          `INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order) VALUES (?,?,?,?,?,?)`,
          [productId, g.name, g.type, g.required, g.sized, gi]
        );
          const groupId = gRes.insertId;
        for (const [oi, o] of g.options.entries()) {
          const [oRes] = await pool.query(
            `INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)`,
            [groupId, o.name, o.price, oi]
          );
            const optionId = oRes.insertId;
          if (o.sizes) {
            for (const [si, sz] of SIZES.entries()) {
              await pool.query(
                `INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order) VALUES (?,?,?,?,?)`,
                [optionId, sz.slug, sz.name, o.sizes[sz.slug], si]
              );
            }
          }
        }
      }
    }
  }

  console.log("✓ seed complete");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
