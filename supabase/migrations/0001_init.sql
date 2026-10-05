-- 0001_init.sql
create extension if not exists "pgcrypto";

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  phone text not null,
  email text not null,
  event_type text,
  event_date date,
  guests integer check (guests is null or guests > 0),
  request_type text not null default 'booking'
    check (request_type in ('booking', 'tour_virtual', 'tour_in_person')),
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  source text not null default 'website'
);

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx on public.enquiries (status);

alter table public.enquiries enable row level security;
-- Intentionally no policies for anon/authenticated: access goes through
-- server routes using the service role key.
