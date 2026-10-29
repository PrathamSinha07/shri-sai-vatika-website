# Shri Sai Vatika — Final Deployment Report

**Run date/time:** 2026-10-29, ~16:20–16:55 IST (UTC+05:30)
**Run type:** Master finalization & deployment attempt (read-only audit + local QA + deployment probing)
**Repository:** `E:\Shri Sai Vatika` · remote `origin` → `github.com/PrathamSinha07/shri-sai-vatika-website`

---

## 1. Git state

| Item | Value |
| --- | --- |
| Branch | `main` (unchanged; no branch operations performed) |
| Starting commit | `3a8e9b9` — *fix: clarify booking confirmation without email delivery* |
| Ending commit | `3a8e9b9` (unchanged — **nothing staged, committed, or pushed**) |
| Working tree | Only pre-existing untracked file `docs/milestone-10-preflight.sql` (from the prior preflight turn) plus this new report file. No tracked file modified. |

## 2. Files changed in this run

- **`docs/FINAL-DEPLOYMENT-REPORT.md`** — created (this file).
- No application code, migrations, configuration, or environment files were modified.

## 3. Automated checks — actual results

| Check | Result |
| --- | --- |
| `npm run lint` (ESLint) | **PASS** (no findings) |
| `npx tsc --noEmit` | **PASS** (no errors) |
| `npm test` (Node test runner) | **PASS — 107/107** (includes migration-SQL invariants, capacity parser parity, cancelled/reschedule capacity models, admin fail-closed auth, email-failure honesty, WhatsApp encoding, hero/facilities regression guards) |
| `npm run build` (Next.js 16.3.8, Turbopack) | **PASS** — 22 pages generated |

### Browser QA against a local production build (`next start`, port 3001, headless Edge)

| Script | Result | Notes |
| --- | --- | --- |
| `qa-verify.mjs` | **38/38 PASS** | First run 37/38: one smooth-scroll timing flake (`#hash` fresh load sampled mid-animation at 900 ms); passed on immediate re-run. Not a regression. |
| `qa-header.mjs` | **32/32 PASS** | Header/hero/anchor behaviour. |
| `qa-responsive.mjs` | **125/125 PASS** | Multi-viewport layout, no overflow, screenshots in `.agent-tmp/resp-shots/`. |
| `qa-visual-refinement.mjs` | **74/75** | The 1 FAIL is **"Availability endpoint intact → 500"** — caused by the dead Supabase host (see §6), not by code: the API answered the documented honest `{ok:false}` and the server logged a handled fetch error. All booking-form validation, honeypot (no write), and design checks passed. |
| `qa-milestone8.mjs` | **75/75 PASS** | First run 74/75: same smooth-scroll timing flake; passed on re-run. |
| `qa-admin.mjs` | **NOT run (deliberate)** | It seeds and deletes bookings in the live database using the service-role key — forbidden under this run's data rules. |
| `qa-admin-fail-closed.mjs` | **NOT run (deliberate)** | Requires credentials produced by `qa-admin.mjs` and a real Supabase sign-in. Fail-closed behaviour is covered by `src/lib/admin/auth.test.ts` and by live unauthenticated probes below. |
| `qa-visual/gallery/director-hero/dev-header` | Not run | Narrower visual/screenshot checks; core verification already covered by the suites above. |

### Local smoke checks (production build, no database writes)

- `GET /` → **200** (106 KB HTML) · `GET /services` → **200** · `GET /admin/login` → **200**
- `GET /admin` (unauthenticated) → **307 redirect to login** ✓ protected
- `GET /api/admin/bookings` (unauthenticated) → **401** ✓ protected
- `GET /api/visit-bookings/availability?date=not-a-date` → **400 `{"ok":false,"booked":[]}`** ✓ validation
- `GET /api/visit-bookings/availability?date=<valid>` → **500 `{"ok":false}`** — Supabase host unreachable (§6). No crash, no data leak.
- Served HTML contains: brand name ✓, "Gate Decoration" ✓, "Passage Decoration" ✓, "98350 63448" ✓; **no "Varmala"**, **no "Baraat Welcome"** ✓ (approved changes intact).

### Secrets audit

- Client bundles scanned (18 files under `.next/static`): **service-role key ABSENT, Resend API key ABSENT**.
- `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY` referenced only in server-side modules (`src/lib/supabase/*`, `src/lib/admin/*`, `src/lib/email/*`). No middleware file exists; admin protection is per-route/per-API (`authorizeApi` + owner allowlist, fails closed).
- No secret value was printed in any output or written to this report.

## 4. Venue information verification (all match client-approved data)

Name *Shri Sai Vatika* · Address *Near T Point, Gola Road, Danapur, Patna – 801503* · Phone *98350 63448* · *3000 sq.ft.* AC hall · *8000 sq.ft.* lawn · *4* deluxe AC rooms · Venue package *₹1,60,000* · Deluxe catering *₹849/person* · Royal catering *₹1,099/person* · Non-veg catering *quoted separately* (no figure invented). Prices are client-provided, unverified by this run. All in `src/content/` (single source of truth).

## 5. Quality/design preservation

Hero branding (fluid `clamp(1rem, 2.6vw, 1.35rem)`, gold, bold, text-shadow) ✓ · burgundy/gold/ivory palette and typography unchanged ✓ · Varmala/baraat-mala removal ✓ · Gate/Passage split ✓ · booking flow, WhatsApp links (URL-encoded, venue number), fixed slots, date rules, duplicate protection, status transitions — all covered by the passing tests and QA above. **No bugs attributable to code were found; no code changes were needed.**

## 6. Production configuration (checked by name only — no values)

Local `.env.local` presence (Vercel-side values cannot be inspected until CLI auth exists):

| Variable | Local | Notes / production requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | not set | Must be set in Vercel to the final URL (else metadata falls back to localhost). Updateable at any time. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | not set | Code default `919835063448` = venue number ✓ |
| `NEXT_PUBLIC_GOOGLE_MAPS_URL` | not set | Falls back to Maps search builder ✓ |
| `SUPABASE_URL` | set — **HOST DOES NOT RESOLVE** | **BLOCKER:** Google public DNS returns **NXDOMAIN (status 3)** for the configured project host, and the running app's `getaddrinfo` fails with `ENOTFOUND` (two independent confirmations; Cloudflare DoH was inconclusive, zero answers). Parent domain resolves and the Resend API is reachable, so general network/DNS is fine — the project was deleted or the URL is wrong. |
| `SUPABASE_SERVICE_ROLE_KEY` | set (server-only) | Validity unverifiable while the URL is dead; never present in client bundles ✓ |
| `ADMIN_OWNER_EMAILS` | set (local) | Must also be set in Vercel — dashboard **fails closed** without it |
| `BOOKING_SLOT_CAPACITY` | not set | **Code default = 2 = client-approved capacity** ✓; recommend explicitly setting `2` in Vercel |
| `RESEND_API_KEY` | set | **Unverified** — `GET https://api.resend.com/domains` returned **401** (key may be scoped/invalid); no email was sent |
| `RESEND_FROM_EMAIL` | set | Domain **`resend.dev`** (Resend test-family sender): delivers only to the account owner, **not to customers**; a verified custom domain is required for real customer email |
| `BOOKING_NOTIFY_EMAIL` | set | Owner inbox configured locally |
| `ENQUIRY_NOTIFY_EMAIL` | not set | Fallback covered by `BOOKING_NOTIFY_EMAIL` ✓ |

Missing email configuration never breaks booking persistence (code + tests), but **booking persistence is currently broken for a different reason: the Supabase project itself is unreachable.**

## 7. Booking-capacity rollout (Milestone 10)

- **Status: BLOCKED → then AWAITING live preflight → then YOUR approval.**
- **Migration `0003_slot_capacity.sql` is NOT applied.** (Never applied by this run; no DDL, no settings changes, no pooler restart, no live connections.)
- Repository audit: 0002/0003 naming and ordering correct; parser parity (DB regex = app regex, default 2, clamp 1–100); cancelled releases capacity; confirm/complete consume nothing; reschedule-into-full rejected; READ COMMITTED assumption documented; RLS untouched; migration rerun-safe; invariants pinned by `migration-capacity.test.ts` (in the 107 passing tests).
- `docs/milestone-10-preflight.sql`: verified **genuinely read-only** statement-by-statement (SHOW/SELECT + anonymous DO blocks with NOTICE only; no SET/DDL/DML/grants/advisory locks). All previously requested clarity fixes are in place: (1) current + default isolation checks, (2) persisted database-level `app.slot_capacity` (6a, `pg_db_role_setting`) separate from session value (6b), (3) missing-table behaviour explicit (expected `undefined_table` abort at §3b = STOP 2), (4) not-applied vs already-applied detection (§4/§7 object inventory), (5) function/trigger/overload detection with correct "not present" notices, (6) exactly-two-allowed vs more-than-two hard stop, (7) six explicit STOP conditions.
- **Live preflight CANNOT be run right now** — the configured Supabase project does not resolve. Outstanding STOP conditions to evaluate once access exists: isolation ≠ `read committed`; table missing; constraint-backed or differently-named unique index; any slot with >2 active bookings; capacity function/trigger definition conflicts or overloads; capacity ≠ 2 at database or session level.

## 8. Deployment status

**NOT DEPLOYED — no URL.** Deployment probing results (no tokens printed):

- Vercel CLI on PATH: **absent** · user auth file: **absent** · local data dir: **absent** · `.vercel/project.json` (project link): **absent** · `VERCEL_TOKEN` env: **absent**.
- No deployment of any kind was attempted; nothing pushed to GitHub; no preview created (nothing to authenticate with).

**Deployment gate assessment:** even with Vercel auth, a production deploy using the current environment would present a live site whose **booking flow cannot persist anything** (dead Supabase host) — materially misleading per your gate. Order of operations: fix Supabase → authenticate Vercel → I deploy (preview first) → you run the preflight SQL → you approve `0003` → capacity 2 goes fully live.

## 9. Email sender status

**UNVERIFIED / awaiting sender-domain configuration.** Facts: API key and from-address are configured locally; the Resend domains endpoint rejected the key (401) so verification status cannot be confirmed; the from-domain is the `resend.dev` test family (owner-inbox delivery only). Full requirements are documented in `docs/deployment.md` (verify a custom domain in Resend → set `RESEND_FROM_EMAIL` on that domain → set `RESEND_API_KEY` + `BOOKING_NOTIFY_EMAIL` in Vercel → one test booking). No email was sent during this run.

## 10. Blockers requiring your manual action (in order)

1. **Restore Supabase access** — the configured project host is NXDOMAIN. Provide a valid project (URL + service-role key in the environment) or recreate the project; if it is new, migrations `0001` + `0002` must be applied there by you (`0003` only after preflight + approval). This is the single most important action.
2. **Authenticate Vercel** — run, in the repo directory: **`npx vercel login`** (one command; after that I can link the project and deploy a preview without further input).
3. **Resend sender domain** (for real customer emails, can follow later) — verify a custom domain per `docs/deployment.md`.

## 11. Manual smoke-test checklist (for after a successful deploy)

1. Homepage loads on the `*.vercel.app` URL; hero branding renders at mobile/tablet/desktop widths.
2. All nav anchors and `/services` pages load; no console errors; images render.
3. Availability widget: pick tomorrow → shows spots; past dates impossible.
4. **Two** bookings into the same date+slot succeed (once `0003` is applied and preflight approved); a third gets the friendly 409. *Until `0003` is applied, only one booking per slot is possible — expected, not a bug.*
5. Cancel a booking → its spot frees immediately; reschedule into a full slot is refused with a friendly message.
6. New booking appears in `/admin` dashboard; confirm/cancel/reschedule/bulk-confirm work; unauthenticated `/admin` redirects to login.
7. Success screen wording: saved-request confirmation; if email is unconfigured, the honest "could not send the email… request has been saved" note — and the WhatsApp/call buttons work (prefilled, venue number).
8. `NEXT_PUBLIC_SITE_URL` shows the final URL in page metadata/OG tags.
