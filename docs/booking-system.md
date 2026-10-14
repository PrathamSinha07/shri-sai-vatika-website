# Booking System — Visit Requests

Status: **implemented** for customer requests (Milestone 5). Owner
dashboard, reschedule/cancel UI, and owner auth are planned later.

## Customer flow

Homepage → Plan Your Visit (`#book-a-visit`) → choose visit date →
choose one fixed time slot → enter customer info → submit →
`POST /api/visit-bookings` → validate → Supabase insert (PENDING) →
customer + owner emails → success UI.

## Rules (enforced in UI, server route, database, and `src/lib/booking/validate.ts`)

- Timezone: `Asia/Kolkata` (browser timezone is never trusted).
- Earliest bookable date = today IST + 1 day.
- Fixed slots only (`src/content/booking.ts`); no custom times.
- Duplicate protection: `UNIQUE (visit_date, time_slot)` on
  `public.visit_bookings`. Conflicts return a friendly message; raw DB
  errors never reach the client.
- New bookings are always created with status `PENDING`.
- Availability shown in the form comes from
  `GET /api/visit-bookings/availability?date=YYYY-MM-DD`; the server
  re-checks the slot again at submission, and the DB unique index is the
  final safeguard.

## Booking API surface (public)

Only two public endpoints exist:

- `POST /api/visit-bookings` — submit a request (validated, honeypot,
  PENDING insert, emails). Returns success/error only plus the new
  booking id for the confirmation screen. **The booking id is not an
  authorization token** and must never be used to fetch booking data.
- `GET /api/visit-bookings/availability?date=YYYY-MM-DD` — returns only
  the list of taken slot labels for that date. No customer name, phone,
  email, message, status, or notes are exposed. `Cache-Control: no-store`.

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

| Action | Allowed from | Writes |
| --- | --- | --- |
| `confirm` | `PENDING`, `RESCHEDULED` | `CONFIRMED` |
| `cancel` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `CANCELLED` |
| `complete` | `CONFIRMED` | `COMPLETED` |
| `reschedule` | `PENDING`, `CONFIRMED`, `RESCHEDULED` | `RESCHEDULED` + new date/slot |

`COMPLETED` and `CANCELLED` are terminal. The client never chooses the
resulting status — it is derived server-side, and every write is a
compare-and-swap against the state the owner was looking at, so stale
tabs get a `409` instead of overwriting newer state. Rescheduling is a
single atomic `UPDATE` guarded by the existing
`UNIQUE (visit_date, time_slot)` index; no second booking table and no
schema change were needed.

Owner operations run server-side behind authentication **and** explicit
owner authorization:

/admin/login → Supabase Auth sign-in → server-side allowlist check
(`ADMIN_OWNER_EMAILS`) → /admin, /admin/bookings. Logging in alone must
not grant owner access, and it does not: a valid non-owner session is
revoked and refused with `403`.

Reschedule/cancellation customer emails are **not** implemented — they
land in Milestone 10. Owner-action email delivery is not claimed anywhere
in the UI.

## Emails (implemented)

- Customer: "Your visit request has been received" — PENDING wording,
  never "confirmed".
- Owner: full new-request summary with booking ID and submission time.
- Email failure never deletes/rolls back a booking; the API responds
  `{ ok: true, emailIssue: true }` and the UI notes that the request was
  saved.

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
- `src/lib/admin/transitions.test.ts` (owner action state machine:
  eligible transitions, terminal states, server-chosen target statuses).

`scripts/qa-admin.mjs` exercises the private dashboard end to end against a
production build (see `docs/admin-dashboard.md`).
