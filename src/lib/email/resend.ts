// Server-only Resend email sender (plain HTTPS, no SDK dependency).
import { requiredEnv } from "@/lib/env";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: requiredEnv("RESEND_FROM_EMAIL"),
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      console.error("Resend delivery failed", res.status, await res.text().catch(() => ""));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend delivery error", err);
    return { ok: false };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(body: string): string {
  return `<div style="font-family:Georgia,serif;color:#2b1a12;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="color:#6b1220;font-size:20px;margin:0 0 16px">Shri Sai Vatika Banquet Hall</h1>
  ${body}
  <p style="color:#6e5947;font-size:12px;margin-top:24px">Near T Point, Gola Road, Danapur, Patna - 801503</p>
</div>`;
}

export function customerConfirmationEmail(b: {
  customerName: string;
  visitDate: string;
  timeSlot: string;
  eventType: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your visit request has been received — Shri Sai Vatika";
  const text = `Namaste ${b.customerName},

Thank you for your interest in Shri Sai Vatika Banquet Hall.

We have received your visit request:
- Visit date: ${b.visitDate}
- Time slot: ${b.timeSlot}
- Event type: ${b.eventType}

Our team will contact you shortly to confirm your visit. This is a request confirmation, not a final confirmation.

Warm regards,
Shri Sai Vatika Banquet Hall
Phone: 98350 63448`;
  const html = layout(`
  <p>Namaste ${escapeHtml(b.customerName)},</p>
  <p>Thank you for your interest in Shri Sai Vatika Banquet Hall. We have received your visit request:</p>
  <ul>
    <li><strong>Visit date:</strong> ${escapeHtml(b.visitDate)}</li>
    <li><strong>Time slot:</strong> ${escapeHtml(b.timeSlot)}</li>
    <li><strong>Event type:</strong> ${escapeHtml(b.eventType)}</li>
  </ul>
  <p>Our team will contact you shortly to confirm your visit. This is a request confirmation, not a final confirmation.</p>
  <p>Warm regards,<br/>Shri Sai Vatika Banquet Hall<br/>Phone: 98350 63448</p>`);
  return { subject, html, text };
}

export function ownerNotificationEmail(b: {
  customerName: string;
  phone: string;
  email: string;
  eventType: string;
  visitDate: string;
  timeSlot: string;
  message: string | null;
  bookingId: string;
  submittedAt: string;
}): { subject: string; html: string; text: string } {
  const subject = "NEW VISIT REQUEST — Shri Sai Vatika";
  const rows = [
    ["Customer name", b.customerName],
    ["Phone", b.phone],
    ["Email", b.email],
    ["Event type", b.eventType],
    ["Visit date", b.visitDate],
    ["Time slot", b.timeSlot],
    ["Message", b.message ?? "—"],
    ["Booking ID", b.bookingId],
    ["Submitted at", b.submittedAt],
  ];
  const text = `NEW VISIT REQUEST\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
  const html = layout(`
  <p><strong>New visit request received.</strong></p>
  <table style="border-collapse:collapse;font-size:14px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#6e5947">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`
      )
      .join("")}
  </table>`);
  return { subject, html, text };
}
