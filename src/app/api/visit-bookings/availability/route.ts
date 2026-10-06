import { NextResponse } from "next/server";
import { getBookedSlots, BookingStoreError } from "@/lib/supabase/server";
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
    const booked = await getBookedSlots(date);
    // Availability only exposes taken slot labels — never customer data.
    return NextResponse.json(
      { ok: true, booked },
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
