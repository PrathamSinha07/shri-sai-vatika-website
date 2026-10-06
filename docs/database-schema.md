# Database Schema

Supabase/PostgreSQL. Migration: `supabase/migrations/0001_init.sql`.

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
- Admin reads happen server-side only.
- Future owner access via Supabase Auth + explicit owner/admin
  authorization; anonymous visitors can only submit bookings and read
  slot availability (never customer records).
- The service role key must never appear in `NEXT_PUBLIC_*` vars or be
  returned by any API route.

Indexes: `created_at`, `status`.

## `public.visit_bookings`

Implemented in `supabase/migrations/0002_visit_bookings.sql`. See
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

- `UNIQUE (visit_date, time_slot)` — prevents duplicate bookings for the
  same slot.
- `CHECK` enforcing `time_slot` ∈ fixed slot list and `status` ∈ statuses.
- Server-side validation of `visit_date` ≥ earliest bookable date.

Indexes: `visit_date`, `status`, `created_at`.
