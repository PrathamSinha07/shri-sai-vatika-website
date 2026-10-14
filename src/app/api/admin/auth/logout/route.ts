import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIES } from "@/lib/admin/auth";
import { ADMIN_LOGIN_PATH, endSession } from "@/lib/admin/session";
import { NO_STORE, safeInternalPath } from "@/lib/admin/paths";

// Signs out of the private dashboard: revokes the Supabase session
// server-side and clears the HTTP-only session cookies.
// GET supports the server-side redirect flow (?next=…); POST answers JSON
// for the dashboard's sign-out button.
export async function GET(request: Request) {
  const store = await cookies();
  const access = store.get(ADMIN_COOKIES.access)?.value;
  const next = safeInternalPath(new URL(request.url).searchParams.get("next"), ADMIN_LOGIN_PATH);

  const response = NextResponse.redirect(new URL(next, request.url));
  await endSession(response, request, access);
  return response;
}

export async function POST(request: Request) {
  const store = await cookies();
  const access = store.get(ADMIN_COOKIES.access)?.value;

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  await endSession(response, request, access);
  return response;
}
