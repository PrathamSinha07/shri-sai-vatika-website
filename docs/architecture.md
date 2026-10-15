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
    layout.tsx          # root layout (fonts, metadata) — no page chrome
    globals.css         # design tokens + tailwind theme
    (public)/           # customer site: public navbar/footer/WhatsApp chrome
      layout.tsx
      page.tsx          # homepage (composed of sections)
      services/         # /services and /services/[slug]
    admin/              # PRIVATE owner dashboard (see docs/admin-dashboard.md)
      login/            # /admin/login (public sign-in)
      (dashboard)/      # /admin and /admin/bookings (authorized owners only)
    api/
      visit-bookings/   # public booking + availability
      admin/            # private auth + booking-management APIs
  components/
    ui/                 # reusable, business-agnostic primitives
    sections/           # homepage/page sections composed from ui + content
    layout/             # public header, footer, whatsapp float
    admin/              # private dashboard UI (never imported by public pages)
  content/              # ALL business info: site.ts, facilities.ts, packages.ts
  lib/
    env.ts              # validated env access
    admin/              # auth, session guards, transitions, action planning,
                        # bulk validation, booking data access
    supabase/           # server client (service role, server-only)
    email/              # resend client + templates + owner-action notifications
    booking/            # visit-booking validation rules + slot capacity
    maps.ts             # google maps url builders
    whatsapp.ts         # click-to-chat url builder
    utils.ts
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
- **Private** owner area: `/admin/login` (public sign-in), `/admin`,
  `/admin/bookings`, and `/api/admin/**`. Behind Supabase Auth **plus** an
  explicit server-side owner allowlist (`ADMIN_OWNER_EMAILS`), verified on
  every protected page and API request — a valid login alone is never
  enough. No signup flow exists, and the area is not linked from any public
  page. See `docs/admin-dashboard.md`.

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
  non-vegetarian catering is quoted separately. A single pre-filled
  WhatsApp enquiry link closes the section; no inclusions, discounts or
  terms are implied beyond what the client confirmed.
- Announcement strip: built (`AnnouncementStrip.tsx`), content in
  `src/content/announcements.ts`. A CSS-only marquee of confirmed
  facilities/services sits between the Hero and the Intro section, with a
  static wrapped fallback under `prefers-reduced-motion: reduce`.
- Location: built (`Location.tsx`), address from `src/content/site.ts`,
  keyless Google Maps embed + directions links via `src/lib/maps.ts`
  (derived from the confirmed address — no invented coordinates).
- Contact: built (`Contact.tsx`), content in `src/content/contact.ts`.
  Phone, WhatsApp and the visit-booking form only; no email address,
  hours or social accounts exist in confirmed material.
- Plan Your Visit: live booking form at `#book-a-visit` with
  `POST /api/visit-bookings` + availability endpoint; see
  `docs/booking-system.md`. The form collects name, phone, email, event
  type, visit date and time slot (no free-text message field); the API
  still accepts an optional `message` for compatibility. Multiple
  customers may hold the same slot up to a configurable capacity
  (`BOOKING_SLOT_CAPACITY`, default 2), enforced atomically in the
  database; the owner dashboard (`docs/admin-dashboard.md`) manages
  bookings, including bulk confirmation and owner-action emails.
- Director's Message: built (`Director.tsx`), content in
  `src/content/director.ts`.
- Reviews/testimonials: intentionally deferred until genuine client-
  provided material exists.

## Rendering

- Marketing pages are static/server-rendered; forms and map embeds hydrate
  only where needed.
- Keep pages server components by default; add `"use client"` only for
  interactivity (forms, motion wrappers).
