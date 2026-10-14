# Owner Dashboard (Private Admin Area)

Status: **implemented** for overview, booking management and safe owner
actions (Milestone 9). Email notifications for owner actions are **not**
implemented — they land in Milestone 10.

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

**No migration was required for Milestone 9.**

- Owner authorization is an env allowlist, not a database role, so no
  `owner_accounts` table was added.
- RLS stays enabled on `visit_bookings`/`enquiries` with **no** policies for
  `anon`/`authenticated`, exactly as before. The dashboard reads and writes
  through the service-role key on the server after authorization, so no public
  read path was created and RLS was never disabled.
- The existing `UNIQUE (visit_date, time_slot)` constraint is untouched and
  remains the final arbiter for double-booking.

### Known pre-existing quirk (not introduced here)

The unique index covers **every** row, including `CANCELLED` ones, while the
public availability API hides cancelled slots. A slot that was cancelled is
therefore still blocked at the database, so a customer can see it as free and
then be told it was "just taken". Fixing it needs an additive migration that
replaces the index with a partial one
(`… where status <> 'CANCELLED'`), which must be applied by hand in the
Supabase SQL editor — left for a later milestone rather than guessed at here.

## Owner actions and status transitions

The client never chooses a resulting status. `PATCH /api/admin/bookings/{id}`
derives it server-side from the action and the booking's current status
(`src/lib/admin/transitions.ts`, unit-tested in `transitions.test.ts`):

| Action | Allowed from | Writes |
| --- | --- | --- |
| `confirm` | `PENDING`, `RESCHEDULED` | `CONFIRMED` |
| `cancel` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `CANCELLED` |
| `complete` | `CONFIRMED` | `COMPLETED` |
| `reschedule` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `RESCHEDULED` + new date/slot |

`COMPLETED` and `CANCELLED` are terminal: no action can resurrect a finished
booking.

### Concurrency safety

Every write is a **compare-and-swap**: the client sends the state it was
looking at (`expected.status`, plus `expected.visitDate`/`expected.timeSlot`
for rescheduling) and the update pins that exact state in its `WHERE` clause.
Zero matched rows means the booking moved on, and the API answers `409` instead
of silently overwriting newer state. The destination of a reschedule is also
pre-checked for conflicts, and the unique index aborts the whole statement if a
concurrent booking wins the race (also `409`) — no partial update is possible.

### Rescheduling: implemented (not deferred)

The existing schema supports rescheduling safely, so it is implemented as a
single atomic `UPDATE` of `visit_date` + `time_slot` (+ `status`) on the
existing row. No second booking table, no duplicate booking API, no
`rescheduled_from` history row, and no schema change were needed. Server-side
validation reuses the public rules: tomorrow-or-later in `Asia/Kolkata`, one of
the four fixed slots, and a free destination slot.

Email notifications for owner actions are **not** delivered — Milestone 10.

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
stale-update and illegal-transition refusals, slot uniqueness and availability
still behaving, logout removing access, and no service-role key or private
booking data in public HTML or `.next/static` bundles.

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
- Owner-action emails (customer confirmation of confirm/cancel/reschedule and
  a summary to the owner inbox) are intentionally not implemented yet —
  Milestone 10.
- The cancelled-slot index quirk above needs a hand-applied migration.
