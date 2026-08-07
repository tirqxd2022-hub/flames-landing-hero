# server/uploads

Page-level images served at `/uploads/*` in production (logo, hero, category
banners, staff photos, etc.). On cPanel, upload this entire folder to
`~/flames-api/uploads/` — Apache rewrites `/uploads/*` to `/api/uploads/*`
and Passenger streams them from disk via `server/src/lib/uploads.js`.

New images uploaded through the admin Media tool land in this same folder.
