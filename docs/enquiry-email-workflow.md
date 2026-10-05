# Enquiry & Email Workflow

Goal: a booking/tour enquiry must be captured even if email delivery fails,
and the customer must get a confirmation without exposing internal details.

## Flow

1. Client submits the enquiry form (`EnquiryForm` section).
2. `POST /api/enquiries`
   - Validate body (zod-style checks; keep dependency-light).
   - Insert row into Supabase `enquiries` using the service role key
     (`SUPABASE_SERVICE_ROLE_KEY`), server-only.
   - On insert success:
     - Resend email to manager: name, phone, email, event details, request type.
     - Resend confirmation to the customer: receipt of enquiry, next step
       expectation, venue contact (WhatsApp/phone).
   - Email failures do **not** roll back the DB insert; log and report success
     to the user with a note that confirmation email may follow shortly.
   - On validation/insert failure: return a clear error and do not send emails.
3. Manager follows up via phone/WhatsApp; admin interface (later) can update
   `status`.

## Templates

Keep templates minimal and on-brand: plain text + simple HTML, maroon/gold
accents, no heavy images. Templates live in `src/lib/email/`.

## Guardrails

- Rate-limit or add a spam honeypot field before production.
- Never send service-role errors to the client.
- Customer confirmation uses the Resend verified sender for this domain.
