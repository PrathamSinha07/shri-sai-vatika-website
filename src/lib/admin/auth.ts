// Supabase Auth (GoTrue) — raw REST, server-only.
//
// The project has no Supabase JS client: all existing Supabase access goes
// through direct REST calls authenticated with the service-role key (see
// src/lib/supabase/server.ts). Authentication follows the same convention so
// no new dependency is required, and the service-role key stays server-side.
import { requiredEnv } from "@/lib/env";

export const ADMIN_ALLOWLIST_ENV = "ADMIN_OWNER_EMAILS";

/** Session cookies for the private owner dashboard (HTTP-only, set server-side). */
export const ADMIN_COOKIES = {
  access: "ssv_admin_at",
  refresh: "ssv_admin_rt",
  /** Set by the refresh endpoint so a failing page cannot loop on refresh. */
  refreshed: "ssv_admin_refreshed",
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds (Supabase default: 3600). */
  expiresIn: number;
  /** Unix seconds when the access token expires. */
  expiresAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

function baseUrl(): string {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

function serviceKey(): string {
  return requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Server-controlled owner allowlist (comma-separated emails).
 * Fails closed: if the variable is missing or empty nobody is authorized,
 * so a deploy without configuration denies every account rather than
 * exposing booking data.
 */
export function ownerAllowlist(): string[] {
  return (process.env.ADMIN_OWNER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = ownerAllowlist();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export function isOwnerAllowlistConfigured(): boolean {
  return ownerAllowlist().length > 0;
}

interface GoTrueTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: { id?: string; email?: string };
  error?: string;
  error_description?: string;
}

function toTokenPair(body: GoTrueTokenResponse): TokenPair | null {
  if (!body.access_token || !body.refresh_token) return null;
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  const expiresAt =
    typeof body.expires_at === "number" ? body.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn,
    expiresAt,
  };
}

export type SignInResult =
  | { ok: true; tokens: TokenPair; user: AuthUser }
  | { ok: false; reason: "invalid_credentials" | "error" };

/**
 * Password sign-in. GoTrue answers 400 "Invalid login credentials" for both an
 * unknown email and a wrong password, so callers cannot distinguish the two —
 * this is what keeps arbitrary addresses from being enumerated.
 */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
      return { ok: false, reason: "invalid_credentials" };
    }
    console.error(`Supabase Auth sign-in failed (${res.status})`);
    return { ok: false, reason: "error" };
  }

  const body = (await res.json()) as GoTrueTokenResponse;
  const tokens = toTokenPair(body);
  if (!tokens || !body.user?.id) {
    console.error("Supabase Auth sign-in returned an unexpected payload");
    return { ok: false, reason: "error" };
  }
  return {
    ok: true,
    tokens,
    user: { id: body.user.id, email: body.user.email ?? email.toLowerCase() },
  };
}

/** Server-side verification of an access token against Supabase Auth. */
export async function verifyAccessToken(
  accessToken: string
): Promise<{ ok: true; user: AuthUser } | { ok: false }> {
  try {
    const res = await fetch(`${baseUrl()}/auth/v1/user`, {
      headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { id?: string; email?: string };
    if (!body.id) return { ok: false };
    return { ok: true, user: { id: body.id, email: body.email ?? "" } };
  } catch (err) {
    console.error("Supabase Auth token verification failed", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export type RefreshResult = { ok: true; tokens: TokenPair } | { ok: false };

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as GoTrueTokenResponse;
    const tokens = toTokenPair(body);
    return tokens ? { ok: true, tokens } : { ok: false };
  } catch (err) {
    console.error("Supabase Auth refresh failed", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/** Revokes the session server-side. Always safe to call; failures are ignored. */
export async function revokeSession(accessToken: string): Promise<void> {
  try {
    await fetch(`${baseUrl()}/auth/v1/logout`, {
      method: "POST",
      headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Best effort — the cookies are cleared regardless.
  }
}
