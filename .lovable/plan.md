
# Staff Attendance Module

Goal: capture staff **Check-in** and **Check-out** timestamps (America/Toronto) tied to `admin_users`, driven from the login modal and the logout action, and surface the log in a new **Staff Attendance** tab under Admin → Reports.

Applies to staff only (`admin_users`) — customers are excluded.

---

## 1. Data model

New migration `050_staff_attendance.sql`:

```text
CREATE TABLE staff_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  username VARCHAR(80) NOT NULL,        -- denormalised for fast reports
  check_in_at DATETIME NOT NULL,        -- stored UTC, displayed in CA_TZ
  check_out_at DATETIME NULL,
  check_in_ip VARCHAR(64) NULL,
  check_out_ip VARCHAR(64) NULL,
  source ENUM('login_modal','manual','auto') NOT NULL DEFAULT 'login_modal',
  notes VARCHAR(255) NULL,
  work_date DATE NOT NULL,              -- CA_TZ date of check_in — used for "one row per day" queries
  INDEX (user_id, work_date),
  INDEX (work_date),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Rules:
- **One open row per user at a time** — enforced in code: before insert, close any dangling open row (see §5 "Safety").
- `work_date` is computed server-side from `check_in_at` in America/Toronto so a shift that starts 11:50 pm and ends 00:30 am belongs to the check-in date, matching how staff think of a shift.

---

## 2. Backend endpoints (`server/src/routes/auth.js` + new `attendance.js`)

Auth changes:
- `POST /auth/login` — accept optional `{ check_in: true }`. On successful staff login, if `check_in` is true, call `openAttendance(user)`.
- `POST /auth/logout` — new endpoint. Accepts `{ check_out: boolean }`. Always invalidates the client token client-side; if `check_out` is true and the user is staff, call `closeAttendance(user)`. (Token is JWT so server just records the check-out; no server-side session to destroy.)

New `attendance.js` (admin/super only, gated by `requireAdmin` + role check):
- `GET /admin/attendance?user_id=&from=&to=` — list rows. `from`/`to` are CA_TZ dates.
- `GET /admin/attendance/summary?user_id=&from=&to=` — aggregated totals (days worked, total hours, avg shift length).
- `POST /admin/attendance/:id` — super-admin only, edit `check_in_at` / `check_out_at` / `notes` for corrections.
- `POST /admin/attendance/close-open` — super-admin only, force-close a dangling row (sets `check_out_at = now`, `source='manual'`).

Regular staff can only see **their own** rows (used by Account page later, out of scope for this plan).

---

## 3. Login modal — first-login-of-day check-in

Update `src/components/auth/LoginModal.tsx` and `src/pages/admin/Login.tsx`:

- Add a `Check in for today` checkbox, **checked by default** only when the user has not already checked in today (client can't know that pre-login, so: always show it, default **on**, backend is idempotent — if an open row already exists for today it's a no-op and returns the existing row).
- Pass `check_in` in the login payload.
- After login, if the response includes `attendance: { check_in_at }`, toast: `"Checked in at 9:04 am"` using `formatCA`.

Visual: small helper row below the password field:

```text
[✓] Check in for today            (staff only — hidden for customer login)
```

Hidden entirely when the login form is used by a customer path (no `check_in` sent).

---

## 4. Logout — "Log out or check out too?" modal

Anywhere `logout()` from `src/lib/auth.tsx` is triggered (Header avatar menu, Admin sidebar, Account page):

1. Intercept the click. If `kind === "admin"`, open a new `LogoutChoiceModal`:

```text
┌──────────────────────────────────────┐
│  End your session                    │
│                                      │
│  You're signed in as Priya.          │
│  Checked in at 9:04 am (5h 12m).     │
│                                      │
│  ○ Log out only                      │
│  ● Log out and check out             │
│                                      │
│         [ Cancel ]   [ Confirm ]     │
└──────────────────────────────────────┘
```

2. On confirm:
   - Call `POST /auth/logout { check_out: <choice> }`.
   - Clear the token (existing `purgeToken()` flow).
   - Toast: `"Checked out at 2:16 pm — 5h 12m today"` when check-out was chosen.
3. Customers bypass the modal entirely and log out normally.
4. Auto-logout on token expiry (`auth:invalid`) does NOT check out — the shift stays open and the next login (or a super-admin) resolves it.

---

## 5. Safety / edge cases

- **Dangling shifts**: on check-in, if the user has an open row (`check_out_at IS NULL`) from a previous day, auto-close it at `check_in_at` and mark `source='auto'`, `notes='auto-closed on new check-in'`. Report tab flags these rows with a small "auto" badge so admins can correct times.
- **Double check-in same day**: idempotent — return the existing open row instead of inserting.
- **Manual close** by super-admin: writes `source='manual'` and records who did it in `notes`.
- **Timezone**: all storage in UTC via `NOW()` / JS `new Date()`. Display uses existing `formatCA`. `work_date` computed with `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' })`.
- **Guest role**: no check-in checkbox, no logout modal (read-only role — nothing to attend).

---

## 6. Reports UI — new "Staff Attendance" tab

`src/pages/admin/Reports.tsx` gets a new tab alongside existing ones.

Layout:

```text
Staff Attendance                                       [ Export CSV ]

User: [ Priya  ▾ ]     From: [ 2026-07-01 ]  To: [ 2026-07-23 ]

── Summary ────────────────────────────────────────────
Days worked: 18   Total hours: 92h 15m   Avg shift: 5h 07m

── Log ───────────────────────────────────────────────
Date        Check-in   Check-out   Duration   Source   Notes
2026-07-23  09:04 am   —           (open)     login    
2026-07-22  09:01 am   02:16 pm    5h 15m     login    
2026-07-21  09:12 am   06:45 pm    9h 33m     login    
2026-07-20  09:00 am   05:00 pm    8h 00m     manual   corrected by super
...

[ Prev ]   Page 1 of 2   [ Next ]
```

- Open shift row shows `—` and a live-updating "(open, 5h 12m)" duration.
- Super-admin sees an inline pencil to edit `check_in_at` / `check_out_at`.
- CSV export uses the same filters.
- User dropdown lists all staff (`admin_users`, excluding guest role). Default selection = current user.

Xpert help entry + Help page section added so admins can find the module.

---

## 7. Permissions

- Adds a new RBAC page key `admin_attendance` to `ADMIN_PAGES`.
- Super-admin: full access + edit/close.
- Anyone with `admin_attendance` permission: read all users.
- Any staff without the permission: can still check in/out via login/logout modals, but can't see the Reports tab.

---

## 8. Implementation order

1. Migration 050 + `ensure-schema.js` fallback for the new table.
2. Backend: `attendance.js` helpers (`openAttendance`, `closeAttendance`) + wire into `/auth/login` and new `/auth/logout`.
3. Admin routes + RBAC key.
4. `LoginModal` + admin `Login.tsx` checkbox.
5. `LogoutChoiceModal` + intercept logout in Header / Admin sidebar / Account.
6. Reports tab UI + CSV export.
7. Help page + Xpert knowledge update.

---

## Suggestions / open questions

1. **Auto-checkout at end of day** (e.g. cron at 3 am closes anything still open, marks `source='auto'`). Prevents forever-open shifts when staff just close the browser. Recommended.
2. **Break tracking** — a "Start break / End break" toggle in the header avatar menu, stored as a `staff_breaks` child table. Out of scope for v1 but the schema above leaves room (`check_in_at`/`check_out_at` = shift bounds, breaks are separate).
3. **Kiosk-mode check-in** — a shared tablet at the counter where staff punch a 4-digit PIN to check in without a full login. Would need a `staff_pin` column and a new `/kiosk/attendance` route. Flag for a future phase.
4. **Payroll export** — CSV is enough for now; a monthly PDF summary per user could come later.
5. **IP capture** — I've included `check_in_ip` / `check_out_ip` for lightweight audit; can be dropped if you'd rather not store it.

After you approve, I'll build in the order above.
