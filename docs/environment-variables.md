# Environment Variables

Copy `.env.example` to `.env.local` and fill values. Never commit real secrets.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for metadata/OG |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | public | Click-to-chat number (with country code) |
| `NEXT_PUBLIC_GOOGLE_MAPS_URL` | public | Google Maps place link |
| `SUPABASE_URL` | server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Server-side inserts (never expose) |
| `RESEND_API_KEY` | server | Resend API key |
| `ENQUIRY_NOTIFY_EMAIL` | server | Manager notification inbox |
| `BOOKING_NOTIFY_EMAIL` | server | Owner inbox for new visit requests (falls back to `ENQUIRY_NOTIFY_EMAIL`) |
| `RESEND_FROM_EMAIL` | server | Verified sender address |

Notes:
- `NEXT_PUBLIC_*` values are embedded in the client bundle.
- Service role key and Resend key must only be referenced in server code
  (route handlers / server components).
- Email delivery requires all of: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  and at least one of `BOOKING_NOTIFY_EMAIL` / `ENQUIRY_NOTIFY_EMAIL`.
  `RESEND_FROM_EMAIL` must be a sender verified in your Resend account
  (use `onboarding@resend.dev` only for local testing).
- If any of these are missing, bookings are still stored with
  `status = PENDING`; the API returns `emailIssue: true` and the failure is
  logged server-side (variable names only, never values).
