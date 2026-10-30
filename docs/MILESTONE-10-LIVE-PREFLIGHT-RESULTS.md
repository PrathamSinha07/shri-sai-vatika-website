# Milestone 10 — Live Read-Only Preflight & Migration Execution Record

**Project reference:** `lkqrwareduhcmmqbtbjm`
**Project URL:** `https://lkqrwareduhcmmqbtbjm.supabase.co`
**Last updated:** 2026-10-31 02:17:48 +05:30 (Asia/Kolkata, Saturday)
**Migration:** `supabase/migrations/0003_slot_capacity.sql` — **NOT APPLIED (rejected by read-only session; database unchanged)**
**Approved slot capacity:** 2 active bookings per date/time slot
**Secrets policy:** no credential, token, authorization header, or customer PII appears in this document.

---

## 0. Executive summary

| Item | Result |
| --- | --- |
| Preflight (before approval) | 🟢 **18/18 PASS**, all 6 STOP conditions cleared |
| **Migration execution** | 🔴 **FAIL — not applied**: `25006: cannot execute CREATE INDEX in a read-only transaction` |
| Root cause | The authenticated MCP connection is project-scoped with **`read_only=true`** (role `supabase_read_only_user`, `transaction_read_only = on`). DDL is structurally impossible on this connection. |
| Database state after the failed attempt | **Identical to before** — verified object-by-object (§6). No partial application, no orphaned objects. |
| Customer records | **Unchanged** — count 1 and timestamps byte-identical to the pre-attempt baseline |
| Local tests | ✅ **107/107 pass**, 0 fail |
| Outstanding blocker | Need a DDL-capable execution route (§7) — **approval requested** |

---

## 1. Connection identity & verification (at execution time)

| Field | Actual value |
| --- | --- |
| MCP connection | active, project-scoped (`project_ref=lkqrwareduhcmmqbtbjm`), **`read_only=true`** |
| Database / role | `postgres` / `supabase_read_only_user` (`rolsuper=false`, `rolbypassrls=true`) |
| Session | `transaction_read_only = on` |
| Migration history vs repo | `0001 init`, `0002 visit_bookings` — matches local files exactly → **project identity verified** |
| Booking baseline | total **1** · active **0** · cancelled **1** · created/updated `2026-10-06 16:40:06.857452+00` |

## 2. Migration file verification (before execution)

| Check | Result |
| --- | --- |
| Working copy vs committed repo | `supabase/` **clean**, `git diff HEAD` → **empty** (file identical to the reviewed HEAD version) |
| Size | 6312 bytes · 137 lines |
| SHA-256 | `1A5D28292236CC1A3613A34D9DA58ACAB7533ADC9984506B7C7E91ACADB2EE65` |
| Content review | exact 5-step script: partial index → capacity function → trigger function → trigger → drop old unique index (create-first / drop-last), **no DML**, no settings changes |
| Other migrations | only `0001_init.sql`, `0002_visit_bookings.sql`, `0003_slot_capacity.sql` present — **only 0003 submitted** |

---

## 3. Preflight results (executed live before approval — 18/18 PASS)

| § | Check | **Actual** | Status |
| --- | --- | --- | --- |
| 1 | `default_transaction_isolation` / `transaction_isolation` | **`read committed` / `read committed`** | ✅ PASS |
| 2 | `to_regclass('public.visit_bookings')` | **`visit_bookings`** | ✅ PASS |
| 3 | Old unique index definition | **`CREATE UNIQUE INDEX visit_bookings_date_slot_key ON public.visit_bookings USING btree (visit_date, time_slot)`** — exact | ✅ PASS |
| 3 | Unique **table** constraint on (date, slot) | **none** (only `visit_bookings_pkey`) | ✅ PASS |
| 3 | Index set | 5 indexes = 0002's four + PK; `slot_active_idx` absent | ✅ PASS |
| 3+ | Full constraint inventory | 7 CHECKs + FK `rescheduled_from→id ON DELETE SET NULL` + PK — equals local 0002 | ✅ PASS |
| 5 | Slots with active `count(*) > 1` / `> 2` | **0 / 0 rows** | ✅ PASS |
| 6a | Persisted `app.slot_capacity` | **absent** (only `app.settings.jwt_exp=3600`) → default **2** | ✅ PASS |
| 6b | Session-effective capacity | **`raw_setting=null`, `effective_capacity=2`** | ✅ PASS |
| 7a | Migration history | **`0001 init`, `0002 visit_bookings`** | ✅ PASS |
| 7b | Capacity functions / overloads | **0 definitions / 0 overloads** | ✅ PASS |
| 7c | Trigger `visit_bookings_capacity` | **absent** | ✅ PASS |
| 8 | Booking totals (aggregates only) | **total 1 · active 0 · cancelled 1** | ✅ PASS |
| 9 | `relrowsecurity` / `relforcerowsecurity` / policies | **`true` / `false` / 0 policies** | ✅ PASS |

**STOP conditions 1–6 + section 9: all CLEARED.** Decision at that point: 🟢 GO to apply.

---

## 4. Migration execution record

| Field | Value |
| --- | --- |
| Timestamp | **2026-10-31 02:17:48 +05:30** (attempt made moments earlier) |
| Approved by | user (explicit approval to apply `0003_slot_capacity.sql`) |
| Mechanism used | Supabase MCP **`execute_sql`** — the only SQL-execution capability exposed in this session |
| Mechanism *documented* for DDL | MCP **`apply_migration`** — **not present in this session's tool catalog** (excluded by `read_only=true` mode) |
| Scope of submission | the exact file content (SHA verified above), submitted once, in one call |
| **Outcome** | 🔴 **FAIL / REJECTED — nothing executed** |
| Server error | `25006: cannot execute CREATE INDEX in a read-only transaction` |
| Interpretation | The rejection occurred on the **first statement**; the session is `transaction_read_only = on` as `supabase_read_only_user`, so PostgreSQL refused before any object was created. Per instructions, **no retry, no improvisation, no partial re-runs** were attempted. |

---

## 5. Post-attempt state verification (read-only, mandatory inspection)

Every object was re-inspected after the rejected attempt:

| Verification | Expected if unchanged | **Actual** | Status |
| --- | --- | --- | --- |
| `visit_bookings_date_slot_key` removed? | still present (migration not applied) | **present**, definition unchanged | ✅ unchanged |
| `visit_bookings_slot_active_idx` exists? | absent | **absent** | ✅ unchanged |
| `visit_bookings_slot_capacity()` exists? | absent | **0 definitions** | ✅ unchanged |
| `visit_bookings_enforce_slot_capacity()` exists? | absent | **0 definitions** | ✅ unchanged |
| `visit_bookings_capacity` trigger exists/enabled? | absent | **0 non-internal triggers** | ✅ unchanged |
| Unexpected overloads / duplicate triggers | none | **none** | ✅ unchanged |
| Migration history records 0003? | no (mechanism rejected; history untouched) | **`0001`, `0002` only** | ✅ unchanged |
| RLS flags | `true` / `false` | **`true` / `false`** | ✅ unchanged |
| RLS policies | 0 | **0** (verified pre-attempt; role bypass means counts unaffected) | ✅ unchanged |
| Capacity resolves to 2 | 2 | **2** (nothing persisted; session parse = 2) | ✅ unchanged |
| **Booking count** | 1 | **total 1 · active 0 · cancelled 1** | ✅ **unchanged (1 → 1)** |
| No customer records modified/deleted | timestamps identical | `min(created_at)` = `max(updated_at)` = **`2026-10-06 16:40:06.857452+00`** — identical to baseline | ✅ unchanged |

**Conclusion: the database is byte-for-byte in its pre-approval state. No partial application occurred.**

---

## 6. Local verification (after the failed attempt)

| Check | Result |
| --- | --- |
| `npm test` | ✅ **107/107 pass**, 0 fail |
| `npm run lint` | ✅ clean (unchanged since last run) |
| `npm run build` | ✅ 22 routes (unchanged since last run) |
| Preflight SQL parse (libpg_query) | ✅ 18/18 statements |
| Migration file vs HEAD | ✅ identical, `supabase/` clean |

---

## 7. Outstanding warnings & the exact blocker

**Warning 1 — execution route is read-only by design.** The MCP server is configured at
`~/.config/opencode/opencode.json` with `…/mcp?project_ref=lkqrwareduhcmmqbtbjm&read_only=true&features=database,docs`.
In read-only mode Supabase runs SQL as `supabase_read_only_user` and **excludes `apply_migration`**. The preflight was therefore fully automatable, but **DDL is not**, on this connection. This is the correct security posture for an unattended agent — it is a *scope* limit, not a defect in the migration or the project.

**Warning 2 — nothing is wrong with the migration itself.** It passed preflight 18/18, parses cleanly, matches the reviewed HEAD version, and PostgreSQL rejected it at the transaction level — the file was never parsed or executed by the server.

**Warning 3 — do not re-run ad hoc.** Repeated attempts on the same read-only connection will always fail with `25006` and change nothing.

### Options to complete the migration (approval required for any of them)

1. **Recommended — enable the supported DDL tool:** remove `read_only=true` from the MCP URL in `~/.config/opencode/opencode.json` and restart OpenCode, which exposes **`apply_migration`** (the documented DDL mechanism, and it also records `0003` in the migration history table). I will then apply 0003 and run the full post-migration verification autonomously. *This broadens the agent's DB scope from read-only to DDL-capable on production — I will not make that change without your explicit say-so.*
2. **SQL Editor (guaranteed, one manual paste):** run `supabase/migrations/0003_slot_capacity.sql` in the Supabase SQL Editor; I verify everything afterwards from this session.
3. **Direct password route:** supply the database password (Dashboard → Connect → Session pooler); the `pg` driver harness is already staged in temp and would apply it in a `default_transaction_read_only=off`-free, explicit single transaction.

---

## 8. Final status

| Item | Status |
| --- | --- |
| Milestone 10 preflight | ✅ **COMPLETE — 18/18 PASS, GO verdict recorded** |
| Migration 0003 applied | ❌ **FAIL — not applied** (read-only scope; database verified unchanged) |
| Capacity enforcement live? | ❌ **Not yet** — old one-booking-per-slot unique index still arbiter (equivalent to capacity 1 for active bookings) |
| Data safety | ✅ bookings 1 → 1, timestamps identical, RLS unchanged |
| Local code/tests | ✅ green (107/107) |
| Vercel deployment | ⛔ **not attempted, as instructed** |
| Git | nothing staged, committed, or pushed; `.env.local` untouched (mtime `2026-10-13 18:09:29`) |

**Awaiting your choice from §7 (option 1 recommended) — no further database action will be taken without it.**
