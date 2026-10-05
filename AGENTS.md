# Shri Sai Vatika — Agent Guide

Production website for Shri Sai Vatika Banquet Hall, Patna.

## Non-negotiables

- Business content (venue name, address, phone, tagline, facilities, packages)
  lives in `src/content/`, never inside UI components.
- No secrets in the repo. All credentials come from environment variables
  documented in `.env.example` and `docs/environment-variables.md`.
- Do not invent venue facts, statistics, services, or pricing. Client-provided
  claims are marked as needing verification (see `src/content/site.ts`).
- No generic stock imagery where real venue photography is available; put real
  media in `public/images/` and reference it from `src/content/`.
- Every route/section must be a first-class experience on mobile, tablet,
  laptop, and desktop.
- Keep animations restrained and accessibility intact (semantic HTML, alt text,
  focus states, reduced-motion respect).

## Workflow

- Work milestone by milestone. Do not scaffold the entire site in one pass.
- Before major UI, read `docs/` and keep changes consistent with it.
- Run `npm run lint` and `npm run build` before considering a milestone done.

## Docs

- `docs/architecture.md` — app structure and data flow
- `docs/component-boundaries.md` — reusable UI vs. business sections
- `docs/database-schema.md` — Supabase schema for enquiries/tour requests
- `docs/enquiry-email-workflow.md` — enquiry → Supabase → Resend flow
- `docs/environment-variables.md` — required env vars

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
