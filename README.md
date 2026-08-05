# Flames Gourmet

Restaurant website for [flamesgourmet.ca](https://flamesgourmet.ca) — static React SPA frontend + Shopnaqsh-style plain JavaScript Node/Express/MySQL API, ready to deploy on cPanel.

## Layout

```
/              # Vite + React + TS SPA  → build with `npm run build`, upload dist/ to public_html
└─ server/     # Plain JavaScript Node.js + Express + MySQL API (JWT-secured admin)
```

## Frontend (this folder)

```bash
npm install
npm run dev          # http://localhost:8080
npm run build        # outputs to dist/
```

Environment:

- `VITE_API_URL` — base URL of the backend API. **Leave unset in dev** to use built-in mock data. On production set to `https://new.flamesgourmet.ca/api`.

After `npm run build`, upload everything in `dist/` (including `.htaccess`) into your cPanel `public_html/`.

## Backend

See [`server/README.md`](server/README.md) and [`deployment.md`](deployment.md) for full cPanel Node.js + MySQL deployment instructions.

## Notes

- Lovable preview uses mock data only — no MySQL or Node available in the sandbox.
- Admin demo credentials (preview mode): `admin@flamesgourmet.ca` / `admin123`. In production the credentials are whatever you seed via `ADMIN_BOOTSTRAP_*` env vars.
- Orders are Cash-on-Delivery: customers select items, place an order, and pay at the counter when they pick up.
