-- milestone-10-preflight.sql
-- Read-only preflight for supabase/migrations/0003_slot_capacity.sql.
-- Run manually in the Supabase SQL Editor (it executes as the `postgres`
-- role). Contains NO modifying statements: SELECT / SHOW / guarded DO blocks
-- with RAISE NOTICE only. Nothing is written, dropped, or altered.
--
-- Compare every result against the "expected" notes, then read the STOP
-- conditions at the bottom before applying 0003. Apply 0003 only after all
-- checks pass (see docs/database-schema.md).

-- ===========================================================================
-- 1) Transaction isolation — REQUIRED for the advisory-lock protocol
-- ===========================================================================
-- expected: 'read committed' for BOTH. Any other value => STOP.

show default_transaction_isolation;
show transaction_isolation;

-- ===========================================================================
-- 2) The booking table exists (0001 + 0002 applied)?
-- ===========================================================================
-- expected: a non-null oid.
-- NULL => 0002 is not applied => STOP (STOP 2). The batch is then EXPECTED
-- TO ABORT at the first `'public.visit_bookings'::regclass` cast
-- (section 3b) with `undefined_table`: sections 1, 2, 3a, 4, 6, 7a and 7b
-- will already have run, and that abort is harmless (nothing is ever
-- written) but must itself be treated as STOP 2. Sections 3b, 5, 7c, 8
-- and 9 will not run.

select to_regclass('public.visit_bookings') as visit_bookings_oid;

-- ===========================================================================
-- 3) Existing indexes AND constraints on visit_bookings
-- ===========================================================================
-- expected: among the indexes there is a UNIQUE index named
-- `visit_bookings_date_slot_key` on (visit_date, time_slot) — created by
-- 0002 as a plain index, NOT table constraint.

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'visit_bookings'
order by indexname;

-- expected: NO unique constraint protecting (visit_date, time_slot).
-- A unique TABLE CONSTRAINT (contype 'u') with the same effect means
-- `drop index if exists visit_bookings_date_slot_key` in 0003 would silently
-- no-op and capacity 2 could never be reached (every 2nd booking gets a
-- 23505 conflict). If you see one here => STOP and report it first.

select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.visit_bookings'::regclass
  and c.contype in ('u', 'p', 'x')
order by c.conname;

-- ===========================================================================
-- 4) Exact definition of the old unique index 0003 will drop
-- ===========================================================================
-- expected: `CREATE UNIQUE INDEX visit_bookings_date_slot_key ON
-- public.visit_bookings USING btree (visit_date, time_slot)`.
-- NULL (no such index) => 0003 may already be applied: check the object
-- inventory in section 7 before doing anything.

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and indexname = 'visit_bookings_date_slot_key';

-- ===========================================================================
-- 5) Duplicate date/time slots in existing data
-- ===========================================================================
-- expected: no rows WHILE the old one-booking-per-slot unique index is
-- still in place (verify with sections 3–4). IMPORTANT: if 0003 is
-- ALREADY applied (that index is gone), exactly TWO active bookings in one
-- slot is ALLOWED — the client-approved capacity is 2 — and is not a
-- problem in this query.
-- Rows here while the old unique index still exists => the live schema
-- has drifted from the repo => STOP and investigate first.

select visit_date, time_slot, count(*) as active_bookings
from public.visit_bookings
where status <> 'CANCELLED'
group by visit_date, time_slot
having count(*) > 1
order by visit_date, time_slot;

-- expected: no rows, ALWAYS — this holds both before and after 0003. A
-- slot already holding MORE THAN TWO active bookings exceeds the
-- client-approved capacity of 2, and the 0003 trigger only checks NEW
-- writes, so such data would survive the migration unchanged => STOP
-- (STOP 4) and resolve manually first.

select visit_date, time_slot, count(*) as active_bookings
from public.visit_bookings
where status <> 'CANCELLED'
group by visit_date, time_slot
having count(*) > 2
order by visit_date, time_slot;

-- ===========================================================================
-- 6) Capacity setting: database-level configuration vs. this session
-- ===========================================================================
-- 6a) PERSISTED database-level configuration — what `ALTER DATABASE … SET
-- app.slot_capacity = …` stores, i.e. what NEW pooled PostgREST sessions
-- inherit once the pooler restarts. Read only: this script never sets or
-- changes any setting.
-- expected: no rows (nothing configured — the function then defaults to
-- the client-approved 2), or a row whose setconfig contains
-- `app.slot_capacity=2`.
-- Any persisted app.slot_capacity value OTHER than 2 => STOP/DECIDE
-- (STOP 6): the approved capacity is 2; do not change it from this script.

select
  d.datname,
  coalesce(r.rolname, '(all roles)') as for_role,
  s.setconfig
from pg_db_role_setting s
  join pg_database d on d.oid = s.setdatabase
  left join pg_roles r on r.oid = s.setrole
where d.datname = current_database()
order by for_role;

-- 6b) The CURRENT SQL-editor session value and its effective parse — the
-- exact logic 0003 installs in visit_bookings_slot_capacity() (same regex
-- guard, same default 2, same 1..100 clamp), so it works even before the
-- migration exists. This reflects only THIS session: a value set in any
-- editor session never affects the website — the trigger uses each
-- writing session's value, which for pooled connections comes from 6a
-- after a pooler restart.
-- expected: raw_setting NULL (or '2'), effective_capacity = 2.

select
  current_setting('app.slot_capacity', true) as raw_setting,
  greatest(1, least(100, coalesce(
    case
      when coalesce(btrim(current_setting('app.slot_capacity', true)), '')
           ~ '^[+-]?[0-9]{1,9}$'
        then btrim(current_setting('app.slot_capacity', true))::integer
    end,
    2
  ))) as effective_capacity;

-- ===========================================================================
-- 7) Migration history + object inventory (is 0003 already applied?)
-- ===========================================================================
-- 7a) Supabase CLI history (only populated if migrations were pushed with
-- `supabase db push`; application via the SQL editor leaves no row here).
-- Printed as notices so a missing history table cannot abort the script.

do $$
declare
  r record;
begin
  if exists (
    select 1 from pg_namespace where nspname = 'supabase_migrations'
  ) and exists (
    select 1 from pg_tables
    where schemaname = 'supabase_migrations' and tablename = 'schema_migrations'
  ) then
    raise notice '--- supabase_migrations.schema_migrations ---';
    for r in
      select version, name, statements
      from supabase_migrations.schema_migrations
      order by version
    loop
      raise notice 'version % | %', r.version, coalesce(r.name, '(no name)');
    end loop;
  else
    raise notice 'supabase_migrations.schema_migrations not found (SQL-editor-managed project)';
  end if;
exception
  when others then
    raise notice 'migration history inspection failed (informational only): %', SQLERRM;
end $$;

-- 7b) Capacity objects already present?
-- expected BEFORE applying 0003: the inventory query returns zero rows and
-- BOTH functions are reported "not present" by the notice block below.
-- If either function or the trigger already exists, 0003 may already be
-- applied (it is rerun-safe, but confirm before proceeding). A capacity
-- function reported as OVERLOADED (more than one definition in `public`)
-- is unexpected => treat as STOP 5.

select p.proname, l.lanname, p.provolatile, p.prosecdef
from pg_proc p
  join pg_language l on l.oid = p.prolang
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('visit_bookings_slot_capacity', 'visit_bookings_enforce_slot_capacity')
order by p.proname;

do $$
declare
  fn_name  text;
  fn_count integer;
  def      record;
begin
  foreach fn_name in array
    array['visit_bookings_slot_capacity', 'visit_bookings_enforce_slot_capacity']
  loop
    select count(*) into fn_count
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = fn_name;

    if fn_count = 0 then
      raise notice '%: not present (0003 not applied)', fn_name;
    else
      for def in
        select p.pronargs, pg_get_functiondef(p.oid) as definition
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname = fn_name
        order by p.pronargs
      loop
        raise notice '% (% argument(s)): %', fn_name, def.pronargs, def.definition;
      end loop;
      if fn_count > 1 then
        raise notice 'UNEXPECTED: % is overloaded (% definitions in public) — expected exactly one; STOP condition 5 applies', fn_name, fn_count;
      end if;
    end if;
  end loop;
exception
  when others then
    raise notice 'function inventory inspection failed (informational only): %', SQLERRM;
end $$;

-- 7c) Triggers on the table.
-- expected BEFORE applying 0003: no `visit_bookings_capacity` row.

select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.visit_bookings'::regclass
  and not t.tgisinternal
order by t.tgname;

-- ===========================================================================
-- 8) Booking totals (informational)
-- ===========================================================================
-- expected: whatever the venue has booked so far; 0003 changes no rows.

select
  count(*) as total_bookings,
  count(*) filter (where status <> 'CANCELLED') as active_bookings,
  count(*) filter (where status = 'CANCELLED') as cancelled_bookings
from public.visit_bookings;

select status, count(*)
from public.visit_bookings
group by status
order by status;

-- ===========================================================================
-- 9) RLS unchanged (informational — 0003 must not have touched this)
-- ===========================================================================
-- expected: relrowsecurity = true, relforcerowsecurity = false, and ZERO
-- policies (no anon/authenticated access; service role only).

select relname, relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.visit_bookings'::regclass;

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public' and tablename = 'visit_bookings';

-- ===========================================================================
-- STOP CONDITIONS — do NOT apply 0003 if any of these hold
-- ===========================================================================
-- 1. default_transaction_isolation is not 'read committed' (section 1).
-- 2. visit_bookings does not exist (section 2) — apply 0001/0002 first.
--    Expected companion symptom: the batch aborts with `undefined_table`
--    at the first `'public.visit_bookings'::regclass` cast (section 3b).
--    That abort is harmless (nothing is ever written) and must itself be
--    treated as this STOP 2. Sections 3b, 5, 7c, 8 and 9 will not run.
-- 3. (visit_date, time_slot) uniqueness is enforced by a TABLE CONSTRAINT,
--    or the unique index has a different name than
--    `visit_bookings_date_slot_key` (sections 3–4) — 0003 must be revised
--    by the developer before it is run.
-- 4. Any date+slot already holds MORE THAN TWO active bookings (section
--    5b). Note the asymmetry: if 0003 is already applied, exactly TWO
--    active bookings in one slot is ALLOWED (section 5a); more than two
--    is always a hard stop.
-- 5. A capacity function or the trigger exists with a DIFFERENT
--    definition, or a capacity function is overloaded (more than one
--    definition in `public`) (section 7) — resolve the conflict first.
-- 6. The persisted database-level capacity (section 6a) or the
--    session-effective capacity (section 6b) resolves to anything other
--    than the client-approved 2 — reconcile it deliberately before rollout
--    (this script sets nothing).
-- Otherwise: capture this output INCLUDING the NOTICE messages from the
-- section 7 blocks, keep it with the rollout notes, and proceed to apply
-- 0003 (Supabase SQL editor or `supabase db push`).
