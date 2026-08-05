# Flames Gourmet — cPanel Deployment Guide

This guide is written for the specific cPanel account `gomeslen` deploying to
**https://new.flamesgourmet.ca**, with **no SSH / Terminal access**. Every step
is done from the cPanel web UI (File Manager, MySQL Databases, phpMyAdmin,
Setup Node.js App).

The site has two pieces, both served from the same domain:

| Piece | Source | Lives on cPanel at | How it runs |
|---|---|---|---|
| **Frontend** (React SPA) | repo root → `dist/` | `new.flamesgourmet.ca/` (document root) | Static files served by Apache |
| **Backend** (Express + MySQL API) | `server/` folder | `~/flames-api/` (your home, outside the doc root) | Node.js app via Passenger, mounted at `/api` |

The frontend talks to the backend at `https://new.flamesgourmet.ca/api/*`.
Apache serves the SPA, the bundled `.htaccess` excludes `/api/*` from the SPA
fallback, and Passenger forwards `/api/*` to the Node app.

---

## 0. One-time prerequisites

On your local computer:
- Node.js **20 LTS** and `npm` (`node -v` should show v20.x or v22.x).
- A zip tool. cPanel File Manager can unzip server-side.

You will NOT need SSH at any point.

---

## 1. Create the MySQL database (cPanel → MySQL Databases)

You already have these values (from your `.env`):

```
DB_NAME     = gomeslen_flames_db
DB_USER     = gomeslen_flames_user      ← cPanel prefixes "gomeslen_"
DB_PASSWORD = Gomes@2026!#
DB_HOST     = localhost
DB_PORT     = 3306
```

If you have not created them yet:

1. cPanel → **MySQL® Databases** → create database `flames_db` (cPanel adds the
   `gomeslen_` prefix automatically).
2. Create user `flames_user` with the password above.
3. Add the user to the database with **ALL PRIVILEGES**.

---

## 2. Run the SQL migrations (cPanel → phpMyAdmin)

Because you have no terminal, run the SQL files through phpMyAdmin instead of
the `mysql` CLI.

1. cPanel → **phpMyAdmin** → in the left sidebar, click `gomeslen_flames_db`.
2. Top tab **Import** → **Choose File** → pick `server/migrations/001_init.sql`
   from your local machine → click **Import** at the bottom.
3. Repeat for **each** file in `server/migrations/`, in numeric order:
   - `001_init.sql`
   - `002_subcategories_addons.sql`
   - `003_addon_option_sizes.sql`
   - `004_settings_users_media.sql` ← adds `site_settings`, `admin_users`
     (with role + permissions), and `image_meta` tables. Required for the
     Media, Settings and Users pages in the admin panel.
     - `005_fix_media_paths_admin_super.sql` ← fixes the `.jpeg` product image
       paths and makes sure the owner admin has access to Media, Settings and
       Users.
      - `006_orders_payment.sql` ← adds `payment_method` + `paid_at` columns
        to `orders`. Required for the new admin Orders page (paid toggle,
        payment-mode selection, POS receipt).
      - `007_customers_auth.sql` ← adds the `customers` table for customer
        sign-up / login from the site header, and links orders to a customer.
        Required for the new Dashboard, View Orders and Create Order pages,
        plus the header user icon + dropdown. No GRANT edit needed on cPanel.
      - …any newer migration files that appear in future updates.

After all imports, the **Structure** tab should list tables like
`categories`, `subcategories`, `products`, `addon_groups`, `addon_options`,
`addon_option_sizes`, `orders`, `order_items`, `admins`, `admin_users`,
`site_settings`, `image_meta`.

> Tip: take a backup before each new migration — cPanel → **Backup Wizard** →
> "Download a MySQL Database Backup".

### 2b. Create the two image folders outside the document root

Both folders sit next to `flames-api/` so Apache can serve them at
`/uploads` and `/products` while keeping originals outside the SPA.

1. cPanel → **File Manager** → open `/home/gomeslen/`.
2. Click **+ Folder** → name it `flames-api` (if it doesn't already exist).
3. Inside `flames-api/` create two empty folders: `uploads/` and `products/`.
4. Select each, click **Permissions** → set to `755`.

| Folder | Purpose | Served at |
|---|---|---|
| `~/flames-api/uploads/` | Page images — logo, favicon, hero, etc. | `https://new.flamesgourmet.ca/uploads/<file>` |
| `~/flames-api/products/` | Food/menu item images. | `https://new.flamesgourmet.ca/products/<file>` |

The build ships seed images for these folders in `dist/uploads/` and
`dist/products/` — see step **4b** below. After the site is live you can also
add more images from the admin panel **Media** page (Upload tab → Page Images
or Food Images).

---

## 3. Build the frontend on your local computer

From the repo root:

```bash
npm install

# Point the SPA at the live API on the SAME domain
echo "VITE_API_URL=https://new.flamesgourmet.ca/api" > .env.production

npm run build
```

This produces a `dist/` folder containing `index.html`, an `assets/` folder,
and the `.htaccess` file (copied from `public/.htaccess`).

> If you forget the `VITE_API_URL`, the built site falls back to bundled mock
> data — useful for previews, wrong for production.

---

## 4. Upload the frontend to the domain document root

Your domain document root is `~/new.flamesgourmet.ca/` (visible in your File
Manager screenshot; *not* `public_html`, because this is an addon domain).

1. cPanel → **File Manager** → open `/home/gomeslen/new.flamesgourmet.ca/`.
2. Delete any old `index.html`, old `assets/`, and any leftover deploy files
   (keep `.well-known/`, `cgi-bin/`, and any `ssl` folder).
3. Click **Upload**, drag every file from your local `dist/` folder (NOT the
   `dist` folder itself — just its contents).
4. Back in File Manager, confirm that `.htaccess` is present at
   `~/new.flamesgourmet.ca/.htaccess`. If File Manager hides dotfiles, click
   **Settings** (top right) → check **Show Hidden Files** → reload.

Open **https://new.flamesgourmet.ca** — the home page should render.
(API-driven pages will still be empty until Part 5 is done.)

### 4b. Move seed images into `~/flames-api/uploads` and `~/flames-api/products`

The build now bundles the logo, hero, store-front, food photos, etc. into
`dist/uploads/` and `dist/products/`. The site's `.htaccess` keeps the public
URLs as `/uploads/*` and `/products/*`, but internally routes those requests
through the Node app, which reads files from `~/flames-api/uploads/` and
`~/flames-api/products/`. You must physically move them into `flames-api/`:

1. cPanel → **File Manager** → open
   `/home/gomeslen/new.flamesgourmet.ca/uploads/`.
2. **Select All** → click **Move** → set destination
   `/home/gomeslen/flames-api/uploads` → **Move Files**.
3. Repeat for `/home/gomeslen/new.flamesgourmet.ca/products/` →
   `/home/gomeslen/flames-api/products`.
4. The now-empty `uploads/` and `products/` folders at the document root can be
   deleted after confirming `https://new.flamesgourmet.ca/uploads/flames-logo.png`
   and `https://new.flamesgourmet.ca/products/egg-bhurji-indian-style.jpeg` load.

Reload the homepage — the Flames Gourmet logo, hero video poster and food
photos should now appear. Open a product page (e.g.
`/product/egg-bhurji-indian-style`); the food image should load from
`/products/egg-bhurji-indian-style.jpeg`.

> Only `fire.mp4` (17 MB hero video) is still served from the Lovable CDN to
> keep the repository small. If you want to self-host it, download it from the
> CDN URL referenced in `src/assets/fire.mp4.asset.json` and place it at
> `~/flames-api/uploads/fire.mp4`, then change the import in
> `src/pages/Home.tsx` to `const fireVideo = { url: "/uploads/fire.mp4" };`.

---

## 5. Upload and configure the backend

The backend now matches the Shopnaqsh structure: plain JavaScript in `server/`,
with `server/app.js` as the cPanel startup file. There is **no backend build
step** and no `dist/` folder to upload.

### 5a. Upload `server/` to `~/flames-api/`

1. On your local computer, zip the `server/` folder. **Exclude `node_modules/`
   and any local `.env`.** (On macOS Finder: temporarily move `node_modules`
   out, then right-click `server` → Compress. Or use any zip tool with an
   exclude flag.)
2. cPanel → **File Manager** → go to your home directory `/home/gomeslen/`.
3. If a `flames-api/` folder already exists from a previous broken attempt
   (e.g. its `node_modules` shows as a 63-byte text symlink and the app never
   ran), select it and click **Delete** → permanently delete. Start clean.
4. Click **Upload** → upload `server.zip` into `/home/gomeslen/`.
5. Back in File Manager, right-click `server.zip` → **Extract** into
   `/home/gomeslen/`. This creates `/home/gomeslen/server/`.
6. Right-click the new `server` folder → **Rename** → `flames-api`.

You should now see `/home/gomeslen/flames-api/package.json`,
`/home/gomeslen/flames-api/src/...`, `/home/gomeslen/flames-api/migrations/...`,
and **`/home/gomeslen/flames-api/app.js`**.

### 5b. Create the `.env` file on the server

1. In File Manager, enter `/home/gomeslen/flames-api/`.
2. Click **+ File** → name it `.env` → **Create New File**.
3. Right-click `.env` → **Edit** → confirm encoding → paste:

   ```env
   NODE_ENV=production

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=gomeslen_flames_user
   DB_PASSWORD=Gomes@2026!#
   DB_NAME=gomeslen_flames_db

   JWT_SECRET=31f2fffbbdf1811bd7077bc2b94a73ae5f1f399ccc193fe755019be22bbce694295207aadbb7570323d9d901b3511498

   ADMIN_BOOTSTRAP_EMAIL=admin@flamesgourmet.ca
   ADMIN_BOOTSTRAP_PASSWORD=ChangeMe123!

   CORS_ORIGINS=https://new.flamesgourmet.ca,https://www.new.flamesgourmet.ca
   PUBLIC_SITE_URL=https://new.flamesgourmet.ca

   UPLOADS_DIR=/home/gomeslen/flames-api/uploads
   PRODUCTS_DIR=/home/gomeslen/flames-api/products
   ```

   **Do NOT set `PORT`** — Passenger assigns its own. **Do not set
   `JWT_EXPIRES_IN`** — the app now defaults to a 7-day admin session (matching
   the Shopnaqsh pattern), so you will not be logged out of the admin every 12
   hours. If you ever need a shorter window for compliance reasons, add
   `JWT_EXPIRES_IN=12h` back. Save.

4. Still in `flames-api/`, confirm both folders exist: `uploads/` and
   `products/`. Right-click each → **Change Permissions** → set to **755**.

### 5c. Create the Node.js app in cPanel

cPanel → **Setup Node.js App** → if a previous app for this domain exists with
a bad startup file (e.g. `index.html`) or a failed install, click **Destroy**
first. Then **Create Application** with these EXACT values:

| Field | Value |
|---|---|
| Node.js version | **22.22.3** (or the highest 20.x / 22.x your host lists) |
| Application mode | **Production** |
| Application root | `flames-api` |
| Application URL | `new.flamesgourmet.ca` **/ `api`**  ← type `api` in the path box |
| Application startup file | `app.js` |

Click **Create**.

> **Why `/api` and not blank?** With a blank path, Passenger would intercept
> every request to `new.flamesgourmet.ca` and your static SPA would never be
> served. With `/api`, Apache serves the SPA at `/` and Passenger only handles
> `/api/*` — which matches `VITE_API_URL=https://new.flamesgourmet.ca/api`.

### 5d. Install runtime dependencies

Still in the Node.js App panel for this app:

1. Click **Run NPM Install**. Wait for it to finish (1–3 minutes).

   This installs only the runtime dependencies listed under `dependencies` in
   `package.json` — Express, mysql2, jsonwebtoken, sharp, etc. There is no
   TypeScript, no `tsc`, and no `postinstall` build step.

2. Click **Restart**.

   If the log shows `Cannot find module '.../app.js'`, confirm you uploaded the
   `server/` folder contents and the startup file is exactly `app.js`.


### 5e. Seed the database (first deploy only)

In the same Node.js App panel:

1. Click **Run JS script** → pick **`init-db`** → **Run**.

   This runs `node src/seed.js` against your MySQL database — inserting
   categories, subcategories, products, addon groups with Small/Medium/Large
   prices, and the admin user from `ADMIN_BOOTSTRAP_EMAIL` /
   `ADMIN_BOOTSTRAP_PASSWORD`. It is idempotent: existing rows are updated,
   not duplicated, so it is safe to re-run after future seed changes.

2. Click **Restart** once more.

### 5f. Sanity-check the API

Open in a browser:

```
https://new.flamesgourmet.ca/api/health           → {"ok": true}
https://new.flamesgourmet.ca/api/categories       → JSON array of categories
```

Then visit **https://new.flamesgourmet.ca/category/breakfast** — you should see
the seeded breakfast items, including the Hot Beverages and Smoothies cards
with Small/Medium/Large pricing pulled from the database.

Log in to the admin panel at **https://new.flamesgourmet.ca/admin** with the
bootstrap credentials and **change the password immediately**.

---

## 6. Future updates (no terminal required)

### 6a. Frontend-only change (UI, copy, images)

On your local computer:

```bash
git pull              # or however you sync the repo
npm install           # only if package.json changed
npm run build
```

In cPanel File Manager:

1. Go to `~/new.flamesgourmet.ca/`.
2. Delete the existing `assets/` folder (its filenames are content-hashed and
   would otherwise pile up) and the old `index.html`.
3. Upload everything from your fresh local `dist/` folder again.
4. Hard-refresh the site (Ctrl/Cmd-Shift-R).

### 6b. Backend-only change (API, routes, business logic)

In cPanel File Manager:

1. Re-zip the updated `server/` folder locally (exclude `node_modules/` and
   `.env`).
2. Upload the zip into `/home/gomeslen/`.
3. Open `/home/gomeslen/flames-api/` and **delete** `app.js`, `src/`,
   `migrations/`, `package.json`, `.htaccess`, and `README.md`. **Do NOT delete
   `.env` or `uploads/`.**
4. Right-click the uploaded zip → **Extract** to `~/flames-api-new/`, then
   move `app.js`, `src/`, `migrations/`, `package.json`, `.htaccess`, and
   `README.md` over into `~/flames-api/` (overwriting).
5. cPanel → **Setup Node.js App** → your app → **Run NPM Install** (only
   needed when `package.json` changed) → **Restart**.

### 6c. New database migration

When a new file appears in `server/migrations/` (e.g. `004_*.sql`):

1. phpMyAdmin → `gomeslen_flames_db` → **Import** → upload the new SQL file.
2. If the migration ships new seed content, **Setup Node.js App** →
   **Run JS script** → `init-db`.
3. **Restart** the app.

### 6d. Changing environment variables

Edit `/home/gomeslen/flames-api/.env` in File Manager → save → **Restart** the
Node app in Setup Node.js App. The Node app does NOT pick up `.env` changes
without a restart.

### 6e. Adding sized prices for a new product

The schema already supports this — no code change required:

1. Insert an addon group with `is_sized = 1` and `selection_type = 'multi'`.
2. Insert each option with `price = 0` (real price is per-size).
3. Insert three rows in `addon_option_sizes` per option (`slug` = `s`/`m`/`l`).

The menu page will automatically render the S/M/L price card.

### 6f. Rolling back

- **Frontend**: keep the previous `dist.zip` and re-upload it into
  `~/new.flamesgourmet.ca/`.
- **Backend**: keep the previous `server.zip` and re-deploy via step 6b, then
  **Run NPM Install** → **Restart**.
- **Database**: restore the backup you took before migrating
  (cPanel → **Backup Wizard** → restore MySQL).

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Setup Node.js App build log shows `sh: line 1: tsc: command not found` | The old TypeScript backend files are still on cPanel. Delete `/home/gomeslen/flames-api/`, upload the new `server/` folder, set startup file to `app.js`, then run **Run NPM Install** again. |
| `node_modules` shows up as a 63-byte *file* in File Manager (not a folder) | It is a symlink cPanel created pointing into its hidden `nodevenv/` cache — that is normal **as long as Run NPM Install finished successfully**. If install failed midway, delete `node_modules`, then click **Run NPM Install** again. |
| Visiting `https://new.flamesgourmet.ca/api/health` returns the HTML home page | Passenger isn't intercepting `/api/*`. In Setup Node.js App, confirm Application URL path is exactly `api` and **Restart**. Then confirm `~/new.flamesgourmet.ca/.htaccess` contains the `RewriteCond %{REQUEST_URI} ^/api(/|$)` rule (re-upload from `public/.htaccess` if missing). |
| Visiting `/api/health` returns a 503 / "App is not running" | Setup Node.js App → click **Show log** (or check `~/logs/`). Most common: wrong `DB_PASSWORD`, missing `JWT_SECRET`, missing `app.js`, or startup file is not set to `app.js`. |
| Refreshing `/menu` or `/category/breakfast` returns 404 | `.htaccess` missing in `~/new.flamesgourmet.ca/`. Re-upload from `public/.htaccess`. |
| Browser console shows CORS errors | `CORS_ORIGINS` in `.env` must list the exact origin you load the site from (scheme + host, no trailing slash). After editing, **Restart** the Node app. |
| Admin login fails | **Setup Node.js App → Run JS script → `init-db`** — this re-applies the bootstrap admin password from `.env`. |
| Sized prices don't show on a product | The product's addon group needs `is_sized = 1` AND each option needs rows in `addon_option_sizes`. Check in phpMyAdmin. |

---

## 8. Project layout reference

```
Repo (your local computer):
/                              ← Vite + React SPA — build with `npm run build`
  src/                         ← frontend source
  public/.htaccess             ← SPA fallback + /api passthrough, copied into dist/
  dist/                        ← BUILD OUTPUT — upload contents to ~/new.flamesgourmet.ca/

server/                        ← Node.js + Express + MySQL API, Shopnaqsh-style
  app.js                       ← cPanel startup file
  src/                         ← plain JavaScript source
  migrations/*.sql             ← run in numeric order via phpMyAdmin
  package.json                 ← runtime dependencies only; no backend build step
  (.env  created on the server, never committed)

cPanel (~/, gomeslen account):
/home/gomeslen/
  flames-api/                  ← backend uploaded here, Node app root
    app.js  src/  migrations/  uploads/  .env  package.json
  new.flamesgourmet.ca/        ← domain document root (frontend)
    index.html  assets/  .htaccess
```

## Update — migration 008 + profile/account

1. In phpMyAdmin, run `server/migrations/008_profile_fields.sql`
   (adds `full_name`, `phone`, `avatar_url` to `admin_users` and `avatar_url` to `customers`).
2. Re-upload the `dist/` folder and the updated `server/` directory.
3. Restart the Node.js application in cPanel.

New roles available in Admin → Users: **Store Manager**, **SEO Manager**.
Super Admin gains a **Change password** entry in the admin sidebar at `/admin/account`.
Frontend dashboard now exposes a **Your profile** page at `/profile`.

## Update — migration 009 (Drinks, Signature Dishes, Curries, Lunch subcats)

1. In phpMyAdmin, run `server/migrations/009_drinks_signatures_curries_lunch.sql`.
   It is idempotent and adds:
   - Categories: **Drinks**, **Signature Dishes**, **Curries**
   - Lunch subcategories: **Rice Bowl**, **Lunch Combos** (8 menu items)
   - Drinks subcategories: Cans, Smoothies, Hot Beverages, Water
   - Curries subcategories: Vegetarian, Non Veg, Rice Festive, Naan/Bread, Sides, Party Trays Veg, Party Trays Non Veg
   - Signature dish addons: sized Hot Beverages + Smoothies for all 5 plates
2. Re-upload `server/` and `dist/`. **No Node restart required** (data-only migration).
3. In Admin → Menu, open each soft-drink item and upload the exact Canadian
   brand label photo via the Media Picker (Coke, Pepsi, Sprite, Fanta, Dr Pepper,
   Canada Dry, Fuze, Eska, Perrier, Vita Coconut Water). Rice Bowl and Lunch
   Combo items have placeholder $0.00 prices — set the correct price for each.

## Resetting the Admin Password (`reset-admin.js`)

Use this **only when you've lost/forgotten an admin password** and can no longer
log in to change it from Admin → Account. Routine password changes should be
done from the Admin Panel (Account / Users page) — not this script.

Important: `init-db` no longer touches admin passwords (uses `INSERT IGNORE`),
so the only way to force-reset a password from the server is this script.

### What it does

`server/src/reset-admin.js` updates the password hash for the admin row whose
email matches `ADMIN_EMAIL`. If that email does not exist, it creates a new
**super admin** with that email/password. On update it also forces
`is_super = 1` for the matched row. The legacy `admins` table is updated too
when present. No other data (menu, categories, settings, orders) is touched.

### Running it from cPanel (Node.js Selector)

1. cPanel → **Setup Node.js App** → open your app → **Environment variables**.
2. Add two temporary variables:
   - `ADMIN_EMAIL` = the admin email to reset (e.g. `owner@example.com`)
   - `ADMIN_NEW_PASSWORD` = the new password (use quotes if it has symbols)
3. Save, then click **Run JS Script** and select `src/reset-admin.js`
   (path is relative to the app's startup folder = `server/`).
4. Expected output: `✓ password reset for owner@example.com (affectedRows=…)`.
5. **Delete both env vars** from the Node.js app and Save again.

### Running it from SSH

```bash
cd ~/path/to/server
ADMIN_EMAIL=owner@example.com ADMIN_NEW_PASSWORD='NewPass123!' \
  node src/reset-admin.js
```

### Notes

- The email you pass is the account that gets reset — it is not limited to the
  super admin, but the script will promote that account to super admin on
  update. For non-super admin password changes prefer Admin → Users.
- Never commit `ADMIN_EMAIL` / `ADMIN_NEW_PASSWORD` to `server/.env`. If you
  add them there temporarily, remove the lines immediately after running.
