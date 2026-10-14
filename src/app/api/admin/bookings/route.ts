import { NextResponse } from "next/server";
import { authorizeApi, applySessionCookies } from "@/lib/admin/session";
import { isBookingStatus } from "@/lib/admin/transitions";
import {
  BOOKING_SORT_FIELDS,
  AdminBookingStoreError,
  listBookings,
  type BookingSortField,
} from "@/lib/admin/bookings";
import { isValidDateString } from "@/lib/booking/validate";
import { NO_STORE } from "@/lib/admin/paths";

// Private booking list. Every request is verified against Supabase Auth AND the
// owner allowlist before a single row is read; responses are never cached.
export async function GET(request: Request) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);

  const statusRaw = searchParams.get("status") ?? "";
  const status = statusRaw && statusRaw !== "ALL" ? statusRaw : null;
  if (status !== null && !isBookingStatus(status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid status filter." },
      { status: 400, headers: NO_STORE }
    );
  }

  const visitDate = searchParams.get("visitDate") ?? "";
  if (visitDate && !isValidDateString(visitDate)) {
    return NextResponse.json(
      { ok: false, error: "Invalid visit date filter." },
      { status: 400, headers: NO_STORE }
    );
  }

  const sortRaw = searchParams.get("sort") ?? "created_at";
  const sort: BookingSortField = (BOOKING_SORT_FIELDS as readonly string[]).includes(sortRaw)
    ? (sortRaw as BookingSortField)
    : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  try {
    const data = await listBookings({
      status: status ?? undefined,
      visitDate: visitDate || undefined,
      upcoming: searchParams.get("upcoming") === "true",
      search: searchParams.get("q") ?? "",
      sort,
      order,
      page,
      pageSize,
    });

    const response = NextResponse.json(
      { ok: true, ...data, pageCount: Math.max(1, Math.ceil(data.total / pageSize)) },
      { headers: NO_STORE }
    );
    if (auth.refreshed) applySessionCookies(response, auth.refreshed, request);
    return response;
  } catch (err) {
    if (err instanceof AdminBookingStoreError) {
      return NextResponse.json(
        { ok: false, error: "We couldn't load the bookings right now. Please try again." },
        { status: 500, headers: NO_STORE }
      );
    }
    console.error("Admin booking list error", err);
    return NextResponse.json(
      { ok: false, error: "We couldn't load the bookings right now. Please try again." },
      { status: 500, headers: NO_STORE }
    );
  }
}
