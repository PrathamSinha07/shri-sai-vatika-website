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

- RLS enabled on `enquiries`.
- No public select/insert via anon key from clients; the site writes through
  the server route using the service role key.
- Admin reads happen server-side only.

Indexes: `created_at`, `status`.
