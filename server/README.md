# Flames Gourmet — Server (Node + Express + MySQL)

Plain JavaScript API for the Flames Gourmet site. This folder follows the same
cPanel pattern as Shopnaqsh: `app.js` is the startup file and Node runs the
`src/*.js` files directly.

## Local development

```bash
cd server
cp .env.example .env        # fill in DB + JWT_SECRET + admin bootstrap
npm install
npm run dev
```

API health check: `GET http://localhost:4000/health`.

Seed the database after running the SQL migrations:

```bash
npm run init-db
```

## cPanel deployment

1. Upload this `server/` folder outside the domain document root, renamed to
   `/home/gomeslen/flames-api/`.
2. In **Setup Node.js App**, use:
   - **Application root:** `flames-api`
   - **Application URL:** `new.flamesgourmet.ca` / `api`
   - **Application startup file:** `app.js`
3. Create `.env` from `.env.example` in File Manager, including both
   `UPLOADS_DIR` and `PRODUCTS_DIR`.
4. Click **Run NPM Install**, then **Restart**.
5. For the first deploy, click **Run JS script** → `init-db`.

There is no backend build step, no TypeScript, and no `dist/` folder.