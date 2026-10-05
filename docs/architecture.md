# Architecture

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Motion for restrained animations
- Supabase (PostgreSQL) for enquiry persistence
- Resend for transactional email
- Google Maps embed/link for directions
- WhatsApp click-to-chat
- Vercel hosting

## Proposed folder structure

```
src/
  app/
    layout.tsx          # root layout (fonts, metadata, skip link)
    page.tsx            # homepage (composed of sections)
    globals.css         # design tokens + tailwind theme
    api/
      enquiries/route.ts  # POST: store enquiry, send emails
      admin/...           # admin session + enquiry listing (later milestone)
    admin/              # simple admin interface (later milestone)
  components/
    ui/                 # reusable, business-agnostic primitives
    sections/           # homepage/page sections composed from ui + content
    layout/             # header, footer, whatsapp float, skip link
  content/              # ALL business info: site.ts, facilities.ts, packages.ts
  lib/
    env.ts              # validated env access
    supabase/           # server client
    email/              # resend client + templates
    maps.ts             # google maps url builders
    whatsapp.ts         # click-to-chat url builder
    utils.ts
  types/                # shared TS types
public/
  images/               # real venue photography
supabase/
  migrations/           # SQL migrations
docs/
```

## Data flow (enquiry)

1. Visitor submits a tour/booking enquiry form (client component).
2. `POST /api/enquiries` validates input (server-side), inserts into Supabase
   via the service role key, then sends:
   - notification email to the manager (Resend)
   - confirmation email to the customer (Resend)
3. Admin interface (later) reads `enquiries` via Supabase with RLS-aware
   access.

## Rendering

- Marketing pages are static/server-rendered; forms and map embeds hydrate
  only where needed.
- Keep pages server components by default; add `"use client"` only for
  interactivity (forms, motion wrappers).
