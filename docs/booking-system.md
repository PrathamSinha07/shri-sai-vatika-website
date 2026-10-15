# Booking System — Visit Requests

Status: **implemented** for customer requests (Milestone 5), owner
dashboard (Milestone 9), and Milestone 10 (shared per-slot capacity,
bulk confirmation, owner-action customer emails).

## Customer flow

Homepage → Plan Your Visit (`#book-a-visit`) → choose visit date →
choose one fixed time slot → enter customer info → submit →
`POST /api/visit-bookings` → validate → Supabase insert (PENDING) →
customer + owner emails → success UI.

## Rules (enforced in UI, server route, database, and `src/lib/booking/validate.ts`)

- Timezone: `Asia/Kolkata` (browser timezone is never trusted).
- Earliest bookable date = today IST + 1 day.
- Fixed slots only (`src/content/booking.ts`); no custom times.
- **Per-slot capacity:** several customers may hold the same date + slot up
  to a configurable capacity (`BOOKING_SLOT_CAPACITY`, default **2**,
  clamped 1–100). A slot at capacity behaves exactly like the old
  single-booking slot: the form shows it as full and the API answers `409`.
  Conflicts return a friendly message; raw DB errors never reach the client.
  Both the app and the database accept only a bare integer and fall back to
  the default `2` for malformed values, so the display never promises more
  spots than the trigger enforces.
- **Atomic enforcement:** the database trigger in
  `supabase/migrations/0003_slot_capacity.sql` is the final arbiter. It
  serializes writers per exact date + slot with a transaction-scoped
  advisory lock, counts capacity-consuming bookings (everything except
  `CANCELLED`), and aborts the whole statement when the slot is full — so
  concurrent submissions can never oversell. Cancelled bookings release
  their capacity immediately. The no-oversell guarantee assumes the
  database stays at the `read committed` isolation level (the
  Supabase/PostgREST default); this is a documented invariant with a
  pre-apply check in `docs/database-schema.md`, not something the
  migration enforces.
- New bookings are always created with status `PENDING`.
- Availability shown in the form comes from
  `GET /api/visit-bookings/availability?date=YYYY-MM-DD`; the server
  re-checks the slot again at submission, and the database trigger is the
  final safeguard.

## Booking API surface (public)

Only two public endpoints exist:

- `POST /api/visit-bookings` — submit a request (validated, honeypot,
  PENDING insert, emails). Returns success/error only plus the new
  booking id for the confirmation screen. **The booking id is not an
  authorization token** and must never be used to fetch booking data.
- `GET /api/visit-bookings/availability?date=YYYY-MM-DD` — returns the
  configured `capacity`, the `remaining` spots per fixed slot, and the
  list of full slot labels (`booked`, kept for existing consumers). No
  customer name, phone, email, message, status, or notes are exposed.
  `Cache-Control: no-store`.

There is intentionally **no** public endpoint to list bookings, fetch a
booking by id, read customer details, or read owner notes. Do not add one.

## Public vs private areas

- Public customer website: `/` (`#venue`, `#facilities`, `#services`,
  `#gallery`, `#packages`, `#location`, `#book-a-visit`, `#contact`).
  No dashboard links in navbar/footer/homepage, no customer login.
- Private owner area (built, Milestone 9 — see
  `docs/admin-dashboard.md`): `/admin/login`, `/admin`, `/admin/bookings`
  and `/api/admin/**`. Supabase Auth **plus** a server-side owner
  allowlist, verified on every protected page and API request. No owner or
  admin UI is exposed anywhere on the public site.

## Booking ID / status lifecycle

```
PENDING ──confirm──▶ CONFIRMED ──complete──▶ COMPLETED (terminal)
   │                    │
   ├─cancel─▶ CANCELLED (terminal)          RESCHEDULED ──confirm──▶ CONFIRMED
   └─reschedule─▶ RESCHEDULED
```

## Owner dashboard (built — Milestone 9)

Per booking: name, phone, email, event type, event date, visit date,
slot, message, status, owner notes, created_at, updated_at.

Server-enforced actions (`PATCH /api/admin/bookings/{id}`):

| Action | Allowed from | Writes | Slot capacity check |
| --- | --- | --- | --- |
| `confirm` | `PENDING`, `RESCHEDULED` | `CONFIRMED` | never |
| `cancel` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `CANCELLED` | never (frees the slot) |
| `complete` | `CONFIRMED` | `COMPLETED` | never |
| `reschedule` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `RESCHEDULED` + new date/slot | destination only |

`COMPLETED` and `CANCELLED` are terminal. The client never chooses the
resulting status — it is derived server-side
(`src/lib/admin/actions.ts`), and every write is a compare-and-swap
against the state the owner was looking at, so stale tabs get a `409`
instead of overwriting newer state.

**Owner actions and slot capacity.** Confirm, cancel and complete are
pure status changes: they never run a slot-availability (capacity) check
and can never be blocked by one. Only rescheduling checks a destination
slot, counting **other** capacity-consuming bookings (everything except
`CANCELLED`) and **excluding the booking being moved**. The database
trigger (migration `0003`) is the atomic final arbiter: a full
destination aborts the whole `UPDATE` with a `409`. Rescheduling remains
a single atomic `UPDATE` of `visit_date` + `time_slot` (+ `status`) on
the existing row — no second booking table and no history rows.

### Bulk confirmation (`POST /api/admin/bookings/bulk`)

The owner can confirm up to **10** bookings per request
(`MAX_BULK_ITEMS` in `src/lib/admin/bulk.ts` — deliberately separate
from the per-slot customer capacity, which only limits how many
customers fit into one slot).

- Request: `{ "action": "confirm", "bookings": [{ "id", "expectedStatus" }] }`.
- Authorization is identical to every private booking API
  (`authorizeApi()` — Supabase Auth **plus** the owner allowlist) and
  each booking runs through the same transition rules and
  compare-and-swap as a single action; nothing is bypassed for
  throughput. Only bulk `confirm` is supported — bulk cancel/complete/
  reschedule are deliberately not offered.
- Response: `{ ok: true, results: [...], succeeded, failed }` with a
  per-booking result: `ok`, resulting `status`, or a failure `code`
  (`invalid_request`, `invalid_transition`, `stale`, `conflict`,
  `not_found`, `store_error`) plus `emailIssue` on success (customer
  email delivery failure — reported separately from update failures).
  One failing booking never blocks the others: partial success is a
  first-class outcome.

Owner operations run server-side behind authentication **and** explicit
owner authorization:

/admin/login → Supabase Auth sign-in → server-side allowlist check
(`ADMIN_OWNER_EMAILS`) → /admin, /admin/bookings. Logging in alone must
not grant owner access, and it does not: a valid non-owner session is
revoked and refused with `403`.

## Emails (implemented)

- New request — customer: "Your visit request has been received" —
  PENDING wording, never "confirmed".
- New request — owner: full summary with booking ID and submission time.
- Owner actions — customer emails are sent **after** a successful update
  (single action or bulk confirmation): visit confirmed, visit
  cancelled, and visit rescheduled (includes the **new** date/time and
  the previous one for context). `complete` intentionally sends nothing.
- Email failure never deletes/rolls back a booking update. Single
  actions respond `{ ok: true, booking, emailIssue }` and the dashboard
  notes that the update was saved but the email could not be sent; bulk
  results carry a per-booking `emailIssue`. Delivery failures are
  reported separately from update failures everywhere.
- Templates live in `src/lib/email/resend.ts`; the orchestration
  (`src/lib/email/notify.ts`) never throws and never affects the
  database state.

## Security

- Service role key only used server-side (`src/lib/supabase/server.ts`).
- Honeypot field (`website`) silently discards bot submissions.
- No raw DB errors/stack traces returned to clients.
- RLS enabled on `visit_bookings` with no anon/authenticated SELECT
  policies: the public cannot read booking records. All server access
  goes through the service role key. If a future customer lookup feature
  is needed, it requires a separate secure design (never the raw id).

## Tests

`npm test` runs:

- `src/lib/booking/validate.test.ts` (13 cases: today rejected, tomorrow
  accepted, past rejected, slot validation, email/phone/required-field
  validation, duplicate-slot helper checks, honeypot, earliest-date
  helper).
- `src/lib/booking/capacity.test.ts` (capacity default/config/clamp,
  strict-integer parse with malformed values — decimals, mixed text,
  overflow-length digit runs — falling back to the default,
  remaining-spots and fullness semantics).
- `src/lib/booking/migration-capacity.test.ts` (migration invariants:
  every replacement object created before the old unique index is
  dropped, index dropped additively, advisory-lock serialization, only
  `CANCELLED` releases capacity, regex-guarded capacity parse with
  malformed settings falling back to 2, recognizable atomic error; plus a
  sequential model pinning the documented semantics — capacity caps,
  cancelled-slot reuse, reschedule excluding the mover, confirm/complete
  never consulting capacity — and a model of the database
  `app.slot_capacity` parse rule cross-checked against the app-side
  parser).
- `src/lib/admin/transitions.test.ts` (owner action state machine:
  eligible transitions, terminal states, server-chosen target statuses).
- `src/lib/admin/actions.test.ts` (confirm/cancel/complete never require
  a capacity check; reschedule does; stale expectations, illegal
  transitions, same-slot reschedules and public-rule reuse).
- `src/lib/admin/bulk.test.ts` (bulk cap of 10 kept separate from slot
  capacity, envelope vs per-item failures, no transition bypass, partial
  failures expressible).
- `src/lib/admin/auth.test.ts` (owner allowlist: fails closed when
  unset, exact-match, case/whitespace insensitivity).
- `src/lib/admin/bookings.test.ts` (reschedule conflict check counts
  other capacity-consuming bookings excluding the current one; CAS pins
  status/date/slot; capacity/unique/check violations map to conflicts;
  zero matched rows is a stale refusal).
- `src/lib/supabase/server.test.ts` (availability derives full/remaining
  from capacity-consuming bookings; capacity-race and unique-violation
  inserts map to `SlotUnavailableError`; other failures stay generic).
- `src/lib/email/notify.test.ts` (owner-action emails: correct template
  per action, reschedule carries the new date/time, delivery failure /
  throw / missing config all reported as `emailIssue`, never thrown).

`scripts/qa-admin.mjs` exercises the private dashboard end to end against a
production build (see `docs/admin-dashboard.md`).
