# Owner Dashboard (Private Admin Area)

Status: **implemented** for overview, booking management, safe owner
actions, bulk confirmation and owner-action customer emails
(Milestones 9 + 10).

## Privacy rules

The dashboard is for the venue owner and explicitly authorized staff only.

- No link to `/admin` exists in the public navbar, footer, homepage, gallery,
  packages, contact section or anywhere else on the public site.
- There is **no signup, passwordless or customer-account flow**. Customers
  never need an account to book a visit.
- Every protected page and private API verifies the caller server-side.
  A hidden link, a client-side redirect or a successful Supabase login is
  never treated as authorization on its own.
- Booking/customer data is only ever rendered after authorization. It is
  never sent to the browser in a public page, a public API response, a
  browser bundle or a log line.
- The service-role key stays server-side (route handlers / server components
  only) and is never prefixed with `NEXT_PUBLIC_`.

## Routes

| Route | Visibility | Purpose |
| --- | --- | --- |
| `/admin/login` | public | Sign-in form for the private dashboard |
| `/admin` | private | Overview: metrics + recent booking requests |
| `/admin/bookings` | private | Booking list, filters, search, detail, actions |
| `POST /api/admin/auth/login` | public | Password sign-in (Supabase Auth) |
| `POST /api/admin/auth/logout` | public | Revokes the session and clears cookies |
| `GET/POST /api/admin/auth/refresh` | public | Rotates an expired session (needs a valid refresh token) |
| `GET /api/admin/bookings` | private | Filtered / searched / sorted / paginated list |
| `GET /api/admin/bookings/{id}` | private | Booking detail |
| `PATCH /api/admin/bookings/{id}` | private | confirm · cancel · complete · reschedule |
| `POST /api/admin/bookings/bulk` | private | Bulk confirm (max 10 bookings, per-booking results) |

The public customer-facing chrome (navbar, footer, WhatsApp button, skip link)
lives in the `src/app/(public)` route group, so `/admin/*` is never wrapped in
public navigation.

## Authorization model

Three states are distinguished on **every** protected request
(`src/lib/admin/session.ts`):

1. **anonymous** — no Supabase Auth session → redirected to `/admin/login`,
   or `401` from an API.
2. **unauthorized** — a *valid* Supabase session whose identity is not in the
   owner allowlist → the session is revoked and cookies are cleared, or `403`
   from an API. Knowing the URL is not enough.
3. **authorized** — a valid session **and** an allowlisted identity.

Identity is verified server-side against Supabase Auth on each request
(`GET /auth/v1/user` with the access token). Authorization is a separate,
server-controlled allowlist — `ADMIN_OWNER_EMAILS` (comma-separated). It is
read only in server code, so it is never visible to a browser, and it cannot
be edited by any user. **It fails closed:** if the variable is missing or
empty, every account is denied.

This deliberately does **not** trust user-editable Supabase profile metadata
(`user_metadata` / `raw_user_meta_data`), which a user could edit themselves.

### Session handling

- Sign-in uses the Supabase Auth password grant; the returned access and
  refresh tokens are stored in **HTTP-only, SameSite=Lax** cookies
  (`ssv_admin_at`, `ssv_admin_rt`), `Secure` on HTTPS.
- Expired access tokens are rotated through `/api/admin/auth/refresh`
  (server-to-server), so tokens are never read or written by JavaScript.
- Logout revokes the Supabase session server-side, then clears the cookies.
- There is no Supabase JS client in this project (all access is direct REST,
  see `src/lib/supabase/server.ts`); authentication follows the same
  convention, so **no new dependency** was added and no anon key is required.

### Where authorization is enforced

| Layer | Enforcement |
| --- | --- |
| Pages `/admin`, `/admin/bookings` | `requireOwnerPage("<own path>")` runs as the first statement, before any booking data is fetched |
| All `/api/admin/**` data routes | `authorizeApi()` verifies the token **and** the allowlist before touching Supabase |
| Login | A valid login that is not allowlisted is refused with `403` and the Supabase session is revoked immediately |
| Data layer | `src/lib/admin/bookings.ts` is server-only by construction (service-role PostgREST) and is only imported from routes/pages that already passed a guard |

New pages under `src/app/admin/(dashboard)/` **must** call
`requireOwnerPage()` first — this is called out in the layout file.

### Anti-enumeration

GoTrue answers `400 Invalid login credentials` for both an unknown email and a
wrong password, and the login route returns one generic message for both, so
arbitrary addresses cannot be probed for existing accounts. A `403` is only
reachable by someone who has already authenticated as that account.
A small in-memory failure limiter (`src/lib/admin/rate-limit.ts`) slows
credential stuffing on a single instance; it is **not** a substitute for edge
rate limiting (see "Remaining concerns").

## Provisioning the first owner account

There is intentionally no registration flow. Provisioning is a private,
out-of-band step using the existing Supabase project:

1. In Supabase Dashboard → **Authentication → Users → Add user**, create the
   owner with their email address and a strong password, and tick
   **Auto Confirm User**. (Or use the admin API with the service-role key:
   `POST {SUPABASE_URL}/auth/v1/admin/users` with `{ "email": …, "password": …,
   "email_confirm": true }` — `email_confirm: true` means no email is sent.)
2. Add that exact email to `ADMIN_OWNER_EMAILS` in `.env.local` (and in the
   hosting provider's environment variables). Multiple owners are supported as
   a comma-separated list, e.g. `owner@example.com,manager@example.com`.
3. Restart the server. Until step 2 happens the dashboard denies everyone —
   that is the intended fail-closed behaviour, not a bug.
4. To **remove** an owner, delete their entry from `ADMIN_OWNER_EMAILS`; the
   Supabase account can then be deleted too. Their existing session stops
   working on the next request.

`.env.local` was not modified by this milestone: the allowlist value must be
supplied by whoever owns the accounts. Controlled QA accounts
(`qa-owner@shrisaivatika.example`, `qa-outsider@shrisaivatika.example`) are
provisioned by `scripts/qa-admin.mjs`; passwords are stored in the gitignored
`.agent-tmp/qa-admin-creds.json`.

## Database

**Milestone 10 applies one additive migration** —
`supabase/migrations/0003_slot_capacity.sql` (see
`docs/database-schema.md` for the full design). It replaces the old
one-booking-per-slot unique index with a configurable per-slot capacity
enforced atomically inside PostgreSQL (transaction-scoped advisory lock
per date + slot). No rows are deleted or rewritten: every existing
booking is preserved, RLS stays enabled with no anon/authenticated
policies, and no new public path was created.

- Owner authorization remains an env allowlist, not a database role, so
  no `owner_accounts` table exists.
- The dashboard reads and writes through the service-role key on the
  server after authorization, exactly as before.
- Owner actions that consume no new capacity (confirm, cancel,
  complete) can never be blocked by the capacity check; only
  rescheduling checks its destination, and the trigger is the final
  arbiter for concurrent requests.

The migration is **not applied automatically** — apply it by hand
(Supabase SQL editor or `supabase db push` after linking) around the
deploy of this milestone; either order is safe. It creates every
replacement object (partial index, functions, trigger) **before**
dropping the old unique index, so no intermediate application state is
unprotected. The advisory-lock no-oversell guarantee assumes the
database stays at the `read committed` isolation level (the
Supabase/PostgREST default); the migration does not enforce it — verify
with `show default_transaction_isolation;` before applying. All
pre-apply checks are listed in `docs/database-schema.md`.

## Owner actions and status transitions

The client never chooses a resulting status. `PATCH /api/admin/bookings/{id}`
derives it server-side from the action and the booking's current status
(`src/lib/admin/actions.ts` over `src/lib/admin/transitions.ts`,
unit-tested in `actions.test.ts` / `transitions.test.ts`):

| Action | Allowed from | Writes | Slot capacity check |
| --- | --- | --- | --- |
| `confirm` | `PENDING`, `RESCHEDULED` | `CONFIRMED` | never |
| `cancel` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `CANCELLED` | never (frees the slot) |
| `complete` | `CONFIRMED` | `COMPLETED` | never |
| `reschedule` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `RESCHEDULED` + new date/slot | destination only |

`COMPLETED` and `CANCELLED` are terminal: no action can resurrect a finished
booking.

**Bulk confirmation** (`POST /api/admin/bookings/bulk`) confirms up to 10
bookings per request with per-booking success/failure results. It uses the
same authorization gate, transition rules and compare-and-swap as the
single-booking PATCH — one failing booking never blocks or bypasses the
others. The bulk cap is independent of the per-slot customer capacity.

### Concurrency safety

Every write is a **compare-and-swap**: the client sends the state it was
looking at (`expected.status`, plus `expected.visitDate`/`expected.timeSlot`
for rescheduling) and the update pins that exact state in its `WHERE` clause.
Zero matched rows means the booking moved on, and the API answers `409` instead
of silently overwriting newer state. The destination of a reschedule is
pre-checked against **other** capacity-consuming bookings (excluding the
booking being moved), and the slot-capacity trigger aborts the whole statement
if a concurrent booking wins the race (also `409`) — no partial update is
possible.

### Rescheduling and capacity

Rescheduling is a single atomic `UPDATE` of `visit_date` + `time_slot`
(+ `status`) on the existing row — no second booking table, no duplicate
booking API, no `rescheduled_from` history row. Server-side validation
reuses the public rules: tomorrow-or-later in `Asia/Kolkata`, one of the
four fixed slots, a *different* date/slot, and room left in the
destination slot. The database trigger serializes concurrent writers per
slot with a transaction advisory lock, so simultaneous reschedules or
bookings can never oversell a slot (see `docs/database-schema.md`).

### Owner-action emails (implemented — Milestone 10)

After a successful confirm, cancel or reschedule, the customer receives
an email through the existing Resend integration (reschedule emails
carry the new date/time and the previous one). Emails are sent strictly
after the database update; a delivery failure never rolls anything back
and is reported separately (`emailIssue` in the single-action response,
per-booking `emailIssue` in bulk results, plus a dashboard notice).

## UI

The private UI is an operational dashboard, not a copy of the homepage: a
maroon top bar with in-dashboard navigation and sign-out, ivory content
surface, white panels, status pills that always carry a written label (never
colour alone), and mobile card layouts instead of the desktop table below
`768px`. Focus is visible, the detail panel is a labelled `role="dialog"` that
closes on `Escape` and returns focus to the row it came from, and `/admin/*`
pages are marked `noindex`.

## QA

`npm test` covers the transition matrix. `scripts/qa-admin.mjs` exercises the
security requirements for real against a production build — it is not a
mocked walkthrough:

```powershell
npm run build
$env:ADMIN_OWNER_EMAILS="qa-owner@shrisaivatika.example"; npx next start -p 3001
$env:QA_BASE="http://localhost:3001"; node scripts/qa-admin.mjs
```

It verifies: public browsing and submission without an account, absence of
dashboard links in public HTML, unauthenticated redirects/`401`s, a real
non-owner account being denied on both pages and APIs, a real owner logging in
through the UI and confirming/rescheduling/completing/cancelling a booking,
stale-update and illegal-transition refusals, per-slot capacity behaviour
(slots accept bookings up to capacity, refuse beyond it, and release on
cancellation), bulk confirmation (limit, authorization, partial failures),
availability still behaving, logout removing access, and no service-role key
or private booking data in public HTML or `.next/static` bundles.

The seeded QA booking is inserted directly with the service-role key (so no
email is ever sent) and deleted when the run ends.

Fail-closed behaviour has its own check, run against a server started
**without** the allowlist:

```powershell
$env:ADMIN_OWNER_EMAILS=$null; npx next start -p 3002
$env:QA_BASE="http://localhost:3002"; node scripts/qa-admin-fail-closed.mjs
```

It proves that a perfectly valid Supabase owner login is still refused with
`403`, that the private APIs answer `401`, and that `/admin/bookings` issues a
`307` to `/admin/login` without rendering any booking data.

## Remaining concerns

- `ADMIN_OWNER_EMAILS` must be set in the deployment environment; without it
  the dashboard denies everyone (by design).
- The in-memory login limiter is per server instance; production should add
  edge rate limiting (e.g. Vercel WAF or Upstash) and log monitoring.
- `BOOKING_SLOT_CAPACITY` and the database setting `app.slot_capacity` must
  match; the capacity value itself (default 2) is a configuration default,
  not a client-confirmed venue fact — confirm the real per-slot capacity
  with the client and set both accordingly. Both sides accept only a bare
  integer and fall back to `2` for malformed values, so a typo degrades
  capacity instead of failing writes.
- The capacity migration's no-oversell guarantee assumes `read committed`
  isolation (the Supabase/PostgREST default). Nothing in the schema
  enforces that level — if the database default is ever changed, the
  guarantee no longer holds. Pre-apply check documented in
  `docs/database-schema.md`.
- The capacity migration (`0003_slot_capacity.sql`) must be applied by hand
  (Supabase SQL editor or `supabase db push`); no deploy step in this
  repository runs it.
