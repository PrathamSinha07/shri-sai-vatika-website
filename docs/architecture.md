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

## Public vs private areas

- **Public** customer site: `/` with sections `#venue`, `#facilities`,
  `#services`, `#gallery`, `#packages`, `#location`, `#book-a-visit`,
  `#contact`. Public without an account; no dashboard links anywhere in
  the UI.
- **Private** owner area (future milestone, not built): `/admin/login`,
  `/admin`, `/admin/bookings`, behind Supabase Auth plus explicit
  owner/admin authorization. The previous architecture's
  `api/admin/...` placeholders were never implemented and must not be
  exposed publicly.

## Data flow (enquiry)

1. Visitor submits a tour/booking enquiry form (client component).
2. `POST /api/enquiries` validates input (server-side), inserts into Supabase
   via the service role key, then sends:
   - notification email to the manager (Resend)
   - confirmation email to the customer (Resend)
3. Admin interface (later) reads `enquiries` via Supabase with RLS-aware
   access.

## Site sections & navigation

Canonical section ids live in `src/content/navigation.ts` (`sectionIds`):
`home`, `venue`, `facilities`, `services`, `gallery`, `packages`,
`location`, `book-a-visit`, `contact`. Every id above now has a matching
homepage anchor; header and footer navigation links are hash-only on the
homepage and prefix `/` on other routes so they always reach the
homepage section.

- Facilities section: built (`Facilities.tsx`), content in
  `src/content/facilities.ts`.
- Services: built (`Services.tsx` + `/services/[slug]`), official
  categories preserved in `src/content/services.ts`.
- Gallery: built (`Gallery.tsx`) with Photos / Videos tabs, content in
  `src/content/gallery.ts`. Photos are a curated selection of real venue
  photographs with a custom lightbox; `galleryVideos` is intentionally
  empty until the client supplies real video URLs.
- Packages: built (`Packages.tsx`), content in `src/content/packages.ts`.
  Client-confirmed pricing only — Complete Venue Package (₹1,60,000),
  Deluxe Catering (₹849/person), Royal Catering (₹1,099/person);
  non-vegetarian catering is quoted separately. Each offering has a
  pre-filled WhatsApp enquiry link; no inclusions, discounts or terms are
  implied beyond what the client confirmed.
- Location: built (`Location.tsx`), address from `src/content/site.ts`,
  keyless Google Maps embed + directions links via `src/lib/maps.ts`
  (derived from the confirmed address — no invented coordinates).
- Contact: built (`Contact.tsx`), content in `src/content/contact.ts`.
  Phone, WhatsApp and the visit-booking form only; no email address,
  hours or social accounts exist in confirmed material.
- Plan Your Visit: live booking form at `#book-a-visit` with
  `POST /api/visit-bookings` + availability endpoint; see
  `docs/booking-system.md`. Owner dashboard intentionally not built.
- Director's Message: built (`Director.tsx`), content in
  `src/content/director.ts`.
- Reviews/testimonials: intentionally deferred until genuine client-
  provided material exists.

## Rendering

- Marketing pages are static/server-rendered; forms and map embeds hydrate
  only where needed.
- Keep pages server components by default; add `"use client"` only for
  interactivity (forms, motion wrappers).
