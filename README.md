# Shri Sai Vatika Banquet Hall — website

Production website for Shri Sai Vatika Banquet Hall, Patna. A Next.js
(App Router) project in TypeScript with Tailwind CSS: a public marketing
site, a customer visit-booking flow backed by Supabase, and a private
owner dashboard.

Business content (venue details, facilities, packages, contact
information) lives in `src/content/` — it is the single source of truth
and is never hardcoded in components. Client-provided claims (pricing,
capacity) are marked as pending verification.

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values. Each
   variable is described in `docs/environment-variables.md`. The
   dashboard authorization fails **closed** when `ADMIN_OWNER_EMAILS` is
   unset, and booking needs a reachable Supabase project with the
   migrations in `supabase/migrations/` applied.
2. Install and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Regression suite (Node test runner via `tsx`): booking validation, per-slot capacity and migration invariants, owner actions/authorization, email orchestration |

## Stack

- Next.js App Router (`src/app`), React, TypeScript
- Tailwind CSS v4
- Supabase Postgres accessed server-side through direct REST with the
  service-role key (no Supabase JS client); schema lives in
  `supabase/migrations/`
- Resend for transactional emails (visit-request confirmations and owner
  notifications)
- Motion for restrained section animations

## Areas of the site

- **Public** — `/` (venue, facilities, services, gallery, packages,
  location, plan-a-visit, contact sections) and `/services`. No dashboard
  links, no customer login.
- **Private owner dashboard** — `/admin/login`, `/admin`,
  `/admin/bookings` and the `/api/admin/**` routes, protected by Supabase
  Auth **plus** a server-side owner allowlist. It is intentionally not
  linked anywhere on the public site; see `docs/admin-dashboard.md`.

## Documentation

Project documentation lives in [`docs/`](docs/README.md):

- `docs/architecture.md` — app structure, routing, data flow
- `docs/booking-system.md` — visit-booking flow, slots, statuses, owner actions
- `docs/admin-dashboard.md` — dashboard auth, authorization, QA scripts
- `docs/database-schema.md` — Supabase schema
- `docs/enquiry-email-workflow.md` — enquiry → persistence → emails
- `docs/environment-variables.md` — environment variables
- `docs/component-boundaries.md` — reusable UI vs. business sections
