import { NextResponse } from "next/server";
import { getSlotAvailability, BookingStoreError } from "@/lib/supabase/server";
import { isValidDateString, isBookableDate } from "@/lib/booking/validate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";

  if (!isValidDateString(date) || !isBookableDate(date)) {
    return NextResponse.json(
      { ok: false, booked: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { capacity, booked, remaining } = await getSlotAvailability(date);
    // Availability only exposes slot labels, capacity and remaining counts —
    // never customer data. `booked` (slots with no room left) is kept for
    // existing consumers.
    return NextResponse.json(
      { ok: true, booked, capacity, remaining },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof BookingStoreError) {
      return NextResponse.json(
        { ok: false },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Availability error", err);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
