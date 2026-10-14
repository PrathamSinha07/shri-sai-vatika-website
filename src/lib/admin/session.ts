// Session handling and authorization guards for the private owner dashboard.
//
// Three distinct states are enforced on every protected request:
//   1. anonymous          → no Supabase Auth session
//   2. unauthorized       → valid Supabase session, but NOT an allowed owner
//   3. authorized         → valid session AND allowlisted owner
// Server Components use requireOwnerPage(); route handlers use authorizeApi().
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIES,
  isOwnerEmail,
  refreshAccessToken,
  revokeSession,
  verifyAccessToken,
  type AuthUser,
  type TokenPair,
} from "@/lib/admin/auth";

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_REFRESH_PATH = "/api/admin/auth/refresh";
export const ADMIN_LOGOUT_PATH = "/api/admin/auth/logout";

/** Refresh tokens stay valid until used or revoked; 30 days of owner sessions. */
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** Breaks a refresh→page→refresh redirect loop if a token stays unusable. */
const REFRESH_GUARD_MAX_AGE = 15;

export interface AuthorizedSession {
  userId: string;
  email: string;
  accessToken: string;
}

export type SessionCheck =
  | { state: "anonymous" }
  | { state: "expired"; hasRefresh: boolean; recentlyRefreshed: boolean }
  | { state: "unauthorized"; user: AuthUser }
  | { state: "authorized"; session: AuthorizedSession };

function isHttps(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

async function readSessionTokens(): Promise<{
  access: string | null;
  refresh: string | null;
  recentlyRefreshed: boolean;
}> {
  const store = await cookies();
  return {
    access: store.get(ADMIN_COOKIES.access)?.value ?? null,
    refresh: store.get(ADMIN_COOKIES.refresh)?.value ?? null,
    recentlyRefreshed: Boolean(store.get(ADMIN_COOKIES.refreshed)?.value),
  };
}

/**
 * Verifies the current cookies against Supabase Auth. A successful login is
 * never enough: the identity must also appear in the server-side owner
 * allowlist before any booking data is touched.
 */
export const getSessionCheck = cache(async (): Promise<SessionCheck> => {
  const { access, refresh, recentlyRefreshed } = await readSessionTokens();

  if (!access && !refresh) return { state: "anonymous" };

  if (access) {
    const verified = await verifyAccessToken(access);
    if (verified.ok) {
      if (isOwnerEmail(verified.user.email)) {
        return {
          state: "authorized",
          session: {
            userId: verified.user.id,
            email: verified.user.email,
            accessToken: access,
          },
        };
      }
      return { state: "unauthorized", user: verified.user };
    }
  }

  return { state: "expired", hasRefresh: Boolean(refresh), recentlyRefreshed };
});

/**
 * Server-side gate for protected admin pages. Throws a redirect before any
 * booking data is fetched, so unauthorized visitors never see a partial page.
 */
export async function requireOwnerPage(path: string): Promise<AuthorizedSession> {
  const check = await getSessionCheck();

  switch (check.state) {
    case "authorized":
      return check.session;

    case "anonymous":
      redirect(ADMIN_LOGIN_PATH);

    case "unauthorized":
      // Authenticated but not an owner: drop the session entirely.
      redirect(`${ADMIN_LOGOUT_PATH}?next=${encodeURIComponent(`${ADMIN_LOGIN_PATH}?denied=1`)}`);

    case "expired":
      if (check.hasRefresh && !check.recentlyRefreshed) {
        redirect(`${ADMIN_REFRESH_PATH}?next=${encodeURIComponent(path)}`);
      }
      redirect(`${ADMIN_LOGOUT_PATH}?next=${encodeURIComponent(`${ADMIN_LOGIN_PATH}?expired=1`)}`);
  }

  redirect(ADMIN_LOGIN_PATH);
}

export type ApiAuth =
  | { ok: true; session: AuthorizedSession; refreshed: TokenPair | null }
  | { ok: false; response: NextResponse };

const NO_STORE = { "Cache-Control": "no-store" } as const;

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "unauthenticated" },
    { status: 401, headers: NO_STORE }
  );
}

function deniedResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "access_denied" }, { status: 403, headers: NO_STORE });
}

/**
 * Server-side gate for admin API routes. Expired sessions are refreshed
 * inline (the route handler may set cookies); callers must copy
 * `refreshed` onto their response with applySessionCookies().
 */
export async function authorizeApi(): Promise<ApiAuth> {
  const { access, refresh, recentlyRefreshed } = await readSessionTokens();

  if (!access && !refresh) {
    return { ok: false, response: unauthorizedResponse() };
  }

  let sessionUser: AuthUser | null = null;
  if (access) {
    const verified = await verifyAccessToken(access);
    if (verified.ok) sessionUser = verified.user;
  }

  let refreshed: TokenPair | null = null;

  if (!sessionUser) {
    if (!refresh || recentlyRefreshed) {
      return { ok: false, response: unauthorizedResponse() };
    }
    const result = await refreshAccessToken(refresh);
    if (!result.ok) {
      return { ok: false, response: unauthorizedResponse() };
    }
    const reVerified = await verifyAccessToken(result.tokens.accessToken);
    if (!reVerified.ok) {
      return { ok: false, response: unauthorizedResponse() };
    }
    sessionUser = reVerified.user;
    refreshed = result.tokens;
  }

  if (!isOwnerEmail(sessionUser.email)) {
    return { ok: false, response: deniedResponse() };
  }

  return {
    ok: true,
    session: {
      userId: sessionUser.id,
      email: sessionUser.email,
      accessToken: refreshed?.accessToken ?? access ?? "",
    },
    refreshed,
  };
}

/** Copies rotated session cookies onto a route-handler response. */
export function applySessionCookies(
  response: NextResponse,
  tokens: TokenPair,
  request: Request
): void {
  const secure = isHttps(request);
  response.cookies.set(ADMIN_COOKIES.access, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expiresIn + 60,
  });
  response.cookies.set(ADMIN_COOKIES.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

/** Records that a refresh just happened so a failing page cannot loop. */
export function markRefreshed(response: NextResponse, request: Request): void {
  response.cookies.set(ADMIN_COOKIES.refreshed, "1", {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_GUARD_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse, request: Request): void {
  const secure = isHttps(request);
  for (const name of Object.values(ADMIN_COOKIES)) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

/** Best-effort server-side revocation plus cookie clearing. */
export async function endSession(response: NextResponse, request: Request, accessToken?: string) {
  if (accessToken) await revokeSession(accessToken);
  clearSessionCookies(response, request);
}
