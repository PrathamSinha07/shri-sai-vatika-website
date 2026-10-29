# Deployment — Temporary Launch (Vercel Domain, Email Pending)

This guide covers launching the site on a temporary Vercel-provided domain
(e.g. `*.vercel.app`) before the venue's own domain and email sender are
ready. The booking experience is designed to work during such a launch:
**bookings are always saved to Supabase and shown in the owner dashboard,
with or without email.** Nothing here disables the Resend integration —
once a valid sender is configured, emails start working with no code
change.

## What works without any email configuration

- Customers can submit visit requests; each one is stored in Supabase
  with status `PENDING` and appears immediately in the owner dashboard
  (`/admin`, `/admin/bookings`).
- A database failure is never presented as success: the customer sees an
  error and is asked to retry; a saved booking shows a success screen that
  states the request was received and saved.
- If email delivery fails or is not configured, the booking is **not**
  rolled back, and the customer is **not** told an email was sent — the
  success screen adds: "(We could not send the confirmation email right
  now, but your request has been saved.)"
- WhatsApp and phone follow-up: the site offers click-to-chat WhatsApp
  links (prefilled, user-clicked, to the venue number **98350 63448**) and
  a `tel:` call link from the booking success screen, header, and footer.
  WhatsApp messages are only ever sent by a user clicking a link — the
  site never sends them automatically.

## What the owner must do while email is not operational

Email notifications are **not operational until a valid sender
configuration is available** (see the checklist below). Until then:

1. **Check the dashboard regularly** — `/admin/bookings` is the source of
   truth for every visit request. Do not rely on email notifications.
2. **Follow up personally** by phone (98350 63448) or WhatsApp with every
   new `PENDING` request.
3. When a customer mentions they "did not receive the confirmation
   email", that is expected during this phase — the booking is still
   saved; verify it in the dashboard rather than resubmitting.

## Email configuration checklist (exactly what must be set)

Email delivery requires **all** of the following in the deployment
environment (Vercel → Project → Settings → Environment Variables):

| Variable | Requirement |
| --- | --- |
| `RESEND_API_KEY` | A valid Resend API key |
| `RESEND_FROM_EMAIL` | A sender address **verified in the Resend account** |
| `BOOKING_NOTIFY_EMAIL` (or `ENQUIRY_NOTIFY_EMAIL`) | The owner inbox that receives new-request summaries |

Additional notes — do not assume email state without checking these:

- On a temporary `*.vercel.app` domain there is typically **no verified
  sending domain in Resend**, so no sender address can be configured that
  actually delivers. `onboarding@resend.dev` (Resend's test sender) only
  delivers to the Resend account owner's own address and is for local
  testing only — it is not a production sender for customers.
- The Resend integration code remains active: with missing/invalid
  credentials it fails soft per booking (`emailIssue: true`, logged
  server-side with variable names only), and with valid credentials it
  sends both the customer receipt and the owner summary.
- Owner-action emails (confirm/cancel/reschedule from the dashboard) are
  subject to the same configuration; they also fail soft and never block
  the status update.
- `RESEND_FROM_EMAIL` must only be set to a sender you have verified in
  Resend (custom domain or the documented test sender). Do not invent one.

## Other required environment variables for launch

From `.env.example` (see `docs/environment-variables.md` for details):

- `NEXT_PUBLIC_SITE_URL` — set to the actual deployment URL (the Vercel
  domain) so canonical metadata/OG links are correct.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required for bookings to
  be stored at all; without them no booking is saved and the form shows an
  error (never a false success).
- `ADMIN_OWNER_EMAILS` — the owner allowlist for `/admin`; dashboard
  access fails **closed** when unset. Set it before the first login.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — optional override; defaults to the
  venue number `919835063448` (98350 63448).

## Re-enabling email later (own domain)

1. Add and verify the venue's own sending domain in Resend (DNS records).
2. Set `RESEND_FROM_EMAIL` to an address on that verified domain, and set
   `RESEND_API_KEY` and `BOOKING_NOTIFY_EMAIL`.
3. Update `NEXT_PUBLIC_SITE_URL` to the final domain.
4. Send one booking through the form and confirm: the customer receipt
   arrives, the owner summary arrives, and the success screen shows no
   email-failure note.

No code change, migration, or redeploy of application logic is needed for
steps 1–3 beyond the environment-variable updates and a redeploy to pick
them up.
