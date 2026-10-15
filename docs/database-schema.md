# Database Schema

Supabase/PostgreSQL. Migrations: `supabase/migrations/0001_init.sql`,
`0002_visit_bookings.sql`, `0003_slot_capacity.sql`.

## `public.enquiries`

Stores booking and tour requests submitted through the site.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` |
| `created_at` | `timestamptz` | default `now()` |
| `name` | `text` | required |
| `phone` | `text` | required |
| `email` | `text` | required (lowercased) |
| `event_type` | `text` | e.g. wedding, reception, other |
| `event_date` | `date` | nullable |
| `guests` | `integer` | nullable, > 0 |
| `request_type` | `text` | `booking` \| `tour_virtual` \| `tour_in_person` |
| `message` | `text` | nullable |
| `status` | `text` | `new` \| `contacted` \| `closed`, default `new` |
| `source` | `text` | default `website` |

## Security

- RLS enabled on `enquiries`/`visit_bookings`.
- No public select/insert via anon key from clients; the site writes through
  the server route using the service role key.
- Owner reads/updates happen server-side only, behind Supabase Auth **plus**
  the `ADMIN_OWNER_EMAILS` allowlist (`docs/admin-dashboard.md`). RLS was
  not changed and no role/membership table was added — the dashboard reuses
  the service-role path after explicit authorization, so authenticated
  users still have no table access of their own.
- Anonymous visitors can only submit bookings and read slot availability
  (never customer records).
- The service role key must never appear in `NEXT_PUBLIC_*` vars or be
  returned by any API route.

Indexes: `created_at`, `status`.

## `public.visit_bookings`

Implemented in `supabase/migrations/0002_visit_bookings.sql` and
capacity-enabled by `0003_slot_capacity.sql`. See
`docs/booking-system.md`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` |
| `created_at` / `updated_at` | `timestamptz` | `now()` / on update |
| `name` | `text` | required |
| `phone` | `text` | required |
| `email` | `text` | required (lowercased) |
| `event_type` | `text` | required |
| `event_date` | `date` | nullable |
| `visit_date` | `date` | required, ≥ today + 1 (Asia/Kolkata) |
| `time_slot` | `text` | one of the four fixed slots |
| `message` | `text` | nullable |
| `status` | `text` | `PENDING` \| `CONFIRMED` \| `RESCHEDULED` \| `COMPLETED` \| `CANCELLED`, default `PENDING` |
| `owner_notes` | `text` | nullable |

Constraints:

- `CHECK` enforcing `time_slot` ∈ fixed slot list and `status` ∈ statuses.
- Server-side validation of `visit_date` ≥ earliest bookable date.
- Per-slot capacity (migration `0003`) replaces the former
  `UNIQUE (visit_date, time_slot)` index — see below.

Indexes: `visit_date`, `status`, `created_at`, and the partial
`(visit_date, time_slot) WHERE status <> 'CANCELLED'` capacity index.

### Per-slot capacity (migration `0003_slot_capacity.sql`)

Multiple customers may hold the same date + slot up to a configurable
capacity. Additive migration — **no rows are deleted or rewritten**, so
all existing bookings are preserved (the old unique index guaranteed at
most one booking per slot, which any capacity ≥ 1 still allows).

Application order inside the migration is safety-critical: the partial
index, both functions, and the trigger are all created **before** the old
unique index is dropped, so every intermediate state is protected (first
by the old unique index alone, then by both arbors together) — even when
the statements are applied one at a time in autocommit mode.

- `visit_bookings_slot_capacity()` — the capacity: PostgreSQL setting
  `app.slot_capacity`, default **2**, clamped 1–100. Configure with
  `ALTER DATABASE <db> SET app.slot_capacity = '4';` (project owner).
  The value must be a bare integer (optional sign; surrounding spaces
  trimmed; at most 9 digits — longer digit runs would overflow the
  integer type). **Missing, empty, decimal, or otherwise malformed
  values fall back to the safe default of 2** instead of failing every
  capacity-checked write — the same parse rule as the app-side mirror
  `BOOKING_SLOT_CAPACITY` (`src/lib/booking/capacity.ts`); keep the two
  in sync.
- `visit_bookings_enforce_slot_capacity()` — `BEFORE INSERT OR UPDATE OF
  visit_date, time_slot, status` trigger that:
  1. never blocks `CANCELLED` writes (cancellation always succeeds and
     releases the slot),
  2. never blocks updates that keep an already-active booking in its
     current slot (confirm/complete consume no new capacity),
  3. otherwise takes `pg_advisory_xact_lock(hashtextextended('visit_slot:'
     || visit_date || '|' || time_slot, 0))` — serializing concurrent
     writers for that exact slot until the transaction ends — then counts
     capacity-consuming bookings (`status <> 'CANCELLED'`, excluding the
     row being updated) and raises an atomic error
     (`errcode 23514`, "slot capacity exceeded") when the slot is full.
- Because the check happens inside the writing statement under a
  serialized lock, two racing inserts/reschedules can never both pass:
  the loser sees the winner's committed row under READ COMMITTED and its
  whole statement aborts (no partial writes). **This guarantee assumes
  the database-wide isolation level stays `read committed`** (the
  Supabase/PostgREST default). The migration does **not** enforce or
  check the isolation level — under `repeatable read` the re-count after
  the advisory lock could miss a concurrently committed booking.
- Applying order with the app deploy is safe in either direction: before
  the app update, the old app treats any active booking as "taken"
  (conservative); after it, the trigger is the final arbiter for the
  capacity-aware app code. **Apply manually** (Supabase SQL editor or
  `supabase db push` after linking the project) — it is not applied
  automatically by any deploy this repository performs.
- Pre-apply checks (run as the `postgres` role, before applying `0003`):

  ```sql
  show default_transaction_isolation;          -- must be 'read committed'
  select current_setting('app.slot_capacity', true);  -- note any existing value
  ```

  The first check is required: the advisory-lock protocol depends on
  `read committed`. The second is informational — a malformed existing
  value now safely falls back to 2 once the migration is in, instead of
  failing every capacity-checked write.
- RLS stays enabled with no anon/authenticated policies; the trigger and
  functions run with the privileges of the writing role (service role),
  so no public path is created and no grants were added.
