import { NextResponse } from "next/server";
import { authorizeApi, applySessionCookies } from "@/lib/admin/session";
import { parseBulkConfirmBody, validateBulkItem } from "@/lib/admin/bulk";
import {
  BookingConflictError,
  BookingNotFoundError,
  BookingStaleError,
  AdminBookingStoreError,
  applyBookingAction,
} from "@/lib/admin/bookings";
import { sendOwnerActionEmail } from "@/lib/email/notify";
import { NO_STORE } from "@/lib/admin/paths";

interface BulkResult {
  id: string;
  ok: boolean;
  status?: string;
  /** Update failure code — kept separate from email delivery failures. */
  code?: "invalid_request" | "invalid_transition" | "stale" | "conflict" | "not_found" | "store_error";
  error?: string;
  /** Present on successful updates: did the customer email actually deliver? */
  emailIssue?: boolean;
}

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: NO_STORE });
}

// Bulk confirmation (up to MAX_BULK_ITEMS bookings per request).
//
// Same authorization gate as every other private booking API: the owner
// allowlist and Supabase session are verified before any row is touched.
// Each booking runs through the identical compare-and-swap + transition
// rules as the single-booking PATCH — one booking failing (stale view,
// illegal transition, missing) never blocks or bypasses the others, and
// every outcome is reported per booking. Confirming consumes no new slot
// capacity, so no availability check runs here.
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Please submit the form again.", 400);
  }

  const parsed = parseBulkConfirmBody(body);
  if (!parsed.ok) return error(parsed.error, parsed.status);

  const results: BulkResult[] = [];

  for (const item of parsed.items) {
    const check = validateBulkItem(item, parsed.action);
    if (!check.ok) {
      results.push({ id: item.id, ok: false, code: check.code, error: check.error });
      continue;
    }

    try {
      const updated = await applyBookingAction({
        id: check.id,
        action: parsed.action,
        expected: { status: check.expectedStatus },
        nextStatus: check.nextStatus,
      });

      // Customer confirmation email. A delivery failure never fails the
      // update — it is reported separately per booking.
      let emailIssue = false;
      try {
        emailIssue = (
          await sendOwnerActionEmail({ action: parsed.action, booking: updated })
        ).emailIssue;
      } catch (err) {
        console.error("Owner-action email step failed", err instanceof Error ? err.message : err);
        emailIssue = true;
      }

      results.push({ id: check.id, ok: true, status: updated.status, emailIssue });
    } catch (err) {
      if (err instanceof BookingStaleError) {
        results.push({
          id: check.id,
          ok: false,
          code: "stale",
          error: "This booking has changed since you loaded it.",
        });
      } else if (err instanceof BookingNotFoundError) {
        results.push({ id: check.id, ok: false, code: "not_found", error: "This booking could not be found." });
      } else if (err instanceof BookingConflictError) {
        results.push({ id: check.id, ok: false, code: "conflict", error: "This booking could not be updated." });
      } else if (err instanceof AdminBookingStoreError) {
        results.push({ id: check.id, ok: false, code: "store_error", error: "This booking could not be updated." });
      } else {
        console.error("Bulk booking action error", err instanceof Error ? err.message : err);
        results.push({ id: check.id, ok: false, code: "store_error", error: "This booking could not be updated." });
      }
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const response = NextResponse.json(
    { ok: true, results, succeeded, failed: results.length - succeeded },
    { headers: NO_STORE }
  );
  if (auth.refreshed) applySessionCookies(response, auth.refreshed, request);
  return response;
}
