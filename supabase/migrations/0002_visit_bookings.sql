-- 0002_visit_bookings.sql
-- "Plan Your Visit" booking requests. See docs/booking-system.md.

create table if not exists public.visit_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  customer_name text not null check (char_length(customer_name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 20),
  email text not null check (char_length(email) between 3 and 254),

  event_type text not null,
  event_date date,
  visit_date date not null,
  time_slot text not null,

  message text check (message is null or char_length(message) <= 1000),

  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED')),

  owner_notes text,
  rescheduled_from uuid references public.visit_bookings (id) on delete set null,
  source text not null default 'website'
);

-- Fixed slots only (must match src/content/booking.ts).
alter table public.visit_bookings
  add constraint visit_bookings_time_slot_check
  check (time_slot in (
    '09:00 AM – 12:00 PM',
    '01:00 PM – 03:00 PM',
    '03:00 PM – 06:00 PM',
    '06:00 PM – 08:00 PM'
  ));

-- Earliest bookable date is tomorrow in Asia/Kolkata; enforced at the DB too.
alter table public.visit_bookings
  add constraint visit_bookings_visit_date_check
  check (visit_date >= ((now() at time zone 'Asia/Kolkata')::date + 1));

-- Final duplicate protection: one booking per date + slot.
create unique index if not exists visit_bookings_date_slot_key
  on public.visit_bookings (visit_date, time_slot);

create index if not exists visit_bookings_visit_date_idx on public.visit_bookings (visit_date);
create index if not exists visit_bookings_status_idx on public.visit_bookings (status);
create index if not exists visit_bookings_created_at_idx on public.visit_bookings (created_at desc);

alter table public.visit_bookings enable row level security;
-- Intentionally no anon/authenticated policies: all writes go through the
-- server route using the service role key.
