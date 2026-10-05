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
| `RESEND_FROM_EMAIL` | server | Verified sender address |

Notes:
- `NEXT_PUBLIC_*` values are embedded in the client bundle.
- Service role key and Resend key must only be referenced in server code
  (route handlers / server components).
