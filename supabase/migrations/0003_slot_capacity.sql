-- 0003_slot_capacity.sql
-- Multiple customers per date/time slot, with a configurable per-slot
-- capacity. See docs/booking-system.md and docs/database-schema.md.
--
-- Additive and non-destructive: no rows are deleted or rewritten, so every
-- existing booking is preserved. A unique index cannot express "at most N
-- bookings per slot", so the one-booking-per-slot index is replaced by an
-- atomic capacity check inside PostgreSQL. This also resolves the old quirk
-- where a CANCELLED row permanently blocked its slot.
--
-- Application order (safety-critical): every replacement object — the
-- partial index, both functions, and the trigger — is created FIRST, and
-- the old unique index is dropped LAST. Every intermediate state stays
-- protected: until the trigger exists the old unique index still allows at
-- most one booking per slot, and from the moment the trigger exists until
-- the index is dropped both arbors are active (the unique index being at
-- least as strict as any capacity >= 1). Even when the statements are
-- applied one at a time in autocommit mode, there is never an unprotected
-- window.
--
-- Locking approach: the enforcement trigger takes a transaction-scoped
-- advisory lock on the exact (visit_date, time_slot) key before counting,
-- so concurrent inserts/reschedules for the same slot serialize. Under READ
-- COMMITTED the second transaction re-snapshots after acquiring the lock and
-- therefore sees the winner's committed row — two racing requests can never
-- both slip past the capacity check. This guarantee assumes the database
-- stays at the READ COMMITTED isolation level (the Supabase/PostgREST
-- default); the migration does not enforce or check the isolation level —
-- verify it before applying with:
--   show default_transaction_isolation;  -- must be 'read committed'
-- (see the pre-apply checks in docs/database-schema.md). Owner actions that
-- consume no new capacity (confirm, complete, cancel) never take the lock
-- and can never be blocked by it.

-- 1) Fast capacity counts and conflict checks for a date + slot. Cancelled
--    bookings consume no capacity, so they are excluded from the index.
--    Created while the old unique index still exists; two indexes over the
--    same columns coexisting briefly is harmless.
create index if not exists visit_bookings_slot_active_idx
  on public.visit_bookings (visit_date, time_slot)
  where status <> 'CANCELLED';

-- 2) Configurable per-slot capacity (documented default 2, clamped 1..100).
--    Set it with (requires project owner privileges, then reconnect or
--    restart the pooler so new connections pick it up):
--      alter database <database_name> set app.slot_capacity = '4';
--    The value must be a bare integer (optional sign; surrounding spaces are
--    trimmed) of at most 9 digits. Anything else — missing, empty, decimal,
--    text, or a digit run too long for the integer type — falls back to the
--    safe default of 2 instead of failing every capacity-checked write,
--    then the 1..100 clamp applies. This is the same rule as the app-side
--    parser (BOOKING_SLOT_CAPACITY, src/lib/booking/capacity.ts). The app
--    value only drives friendly pre-checks and the availability display —
--    this function is the authority.
create or replace function public.visit_bookings_slot_capacity()
returns integer
language sql
stable
as $$
  select greatest(1, least(100, coalesce(
    case
      when coalesce(btrim(current_setting('app.slot_capacity', true)), '')
           ~ '^[+-]?[0-9]{1,9}$'
        then btrim(current_setting('app.slot_capacity', true))::integer
    end,
    2
  )));
$$;

comment on function public.visit_bookings_slot_capacity() is
  'Configurable visit-slot capacity (app.slot_capacity; missing or malformed -> default 2, clamped 1..100).';

-- 3) Atomic capacity enforcement for INSERT and for any UPDATE that moves a
--    booking into a different slot or revives it. Runs BEFORE the write and
--    aborts the whole statement on violation, so no partial update exists.
create or replace function public.visit_bookings_enforce_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
  cap          integer;
begin
  -- Cancellation consumes no capacity and must never be blocked: a
  -- CANCELLED booking releases its slot for other customers.
  if new.status = 'CANCELLED' then
    return new;
  end if;

  -- Updates that keep an already-active booking in its current slot (e.g.
  -- confirm or complete) consume no new capacity: no check, no lock.
  if tg_op = 'UPDATE'
     and new.visit_date = old.visit_date
     and new.time_slot = old.time_slot
     and old.status <> 'CANCELLED' then
    return new;
  end if;

  -- Serialize concurrent writers for this exact date + slot until the end of
  -- the transaction, then count capacity-consuming bookings (everything
  -- except CANCELLED), excluding the booking being updated.
  perform pg_advisory_xact_lock(hashtextextended(
    'visit_slot:' || new.visit_date::text || '|' || new.time_slot, 0));

  cap := public.visit_bookings_slot_capacity();

  select count(*) into active_count
  from public.visit_bookings
  where visit_date = new.visit_date
    and time_slot = new.time_slot
    and status <> 'CANCELLED'
    and id <> new.id;

  if active_count >= cap then
    -- errcode 23514 (check_violation) with a stable marker message: the app
    -- maps this to a friendly 409 and never exposes the raw error.
    raise exception 'visit_bookings slot capacity exceeded (%)', cap
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 4) Install the trigger while the old unique index is still in place, so
--    the capacity check takes over before the stricter arbor is removed.
drop trigger if exists visit_bookings_capacity on public.visit_bookings;
create trigger visit_bookings_capacity
  before insert or update of visit_date, time_slot, status
  on public.visit_bookings
  for each row
  execute function public.visit_bookings_enforce_slot_capacity();

-- 5) The old final arbiter (one booking per date + slot, cancelled rows
--    included) is removed LAST, once its replacement is fully installed.
--    This drops an index only — no data changes.
drop index if exists public.visit_bookings_date_slot_key;
