import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIES, isOwnerEmail, refreshAccessToken, verifyAccessToken } from "@/lib/admin/auth";
import {
  ADMIN_LOGIN_PATH,
  applySessionCookies,
  clearSessionCookies,
  markRefreshed,
} from "@/lib/admin/session";
import { NO_STORE, safeInternalPath } from "@/lib/admin/paths";

async function rotateSession() {
  const store = await cookies();
  const refreshToken = store.get(ADMIN_COOKIES.refresh)?.value ?? null;
  if (!refreshToken) return { ok: false as const };

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.ok) return { ok: false as const };

  const verified = await verifyAccessToken(refreshed.tokens.accessToken);
  if (!verified.ok || !isOwnerEmail(verified.user.email)) return { ok: false as const };

  return { ok: true as const, tokens: refreshed.tokens };
}

// Server-triggered refresh: an expired access token sends the browser here so
// the rotated cookies can be set (only route handlers may write cookies) and
// the visitor is returned to the admin page they asked for.
export async function GET(request: Request) {
  const next = safeInternalPath(new URL(request.url).searchParams.get("next"), "/admin");
  const result = await rotateSession();

  if (!result.ok) {
    const response = NextResponse.redirect(
      new URL(`${ADMIN_LOGIN_PATH}?expired=1`, request.url)
    );
    clearSessionCookies(response, request);
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  applySessionCookies(response, result.tokens, request);
  markRefreshed(response, request);
  return response;
}

// Client-triggered refresh used by the dashboard after an API call reports an
// expired session. Returns JSON and keeps the visitor on the current page.
export async function POST(request: Request) {
  const result = await rotateSession();

  if (!result.ok) {
    const response = NextResponse.json(
      { ok: false, error: "session_expired" },
      { status: 401, headers: NO_STORE }
    );
    clearSessionCookies(response, request);
    return response;
  }

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  applySessionCookies(response, result.tokens, request);
  markRefreshed(response, request);
  return response;
}
