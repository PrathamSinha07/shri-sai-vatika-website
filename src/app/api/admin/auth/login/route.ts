import { NextResponse } from "next/server";
import {
  isOwnerEmail,
  revokeSession,
  signInWithPassword,
} from "@/lib/admin/auth";
import { applySessionCookies } from "@/lib/admin/session";
import { NO_STORE } from "@/lib/admin/paths";
import { clearLoginFailures, clientIp, isLoginRateLimited, recordLoginFailure } from "@/lib/admin/rate-limit";

// Password sign-in for the private owner dashboard. There is deliberately no
// signup or passwordless flow anywhere in this application: owner accounts are
// provisioned privately in Supabase (see docs/admin-dashboard.md).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Please submit the form again." },
      { status: 400, headers: NO_STORE }
    );
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Please enter your email address and password." },
      { status: 400, headers: NO_STORE }
    );
  }

  const limitKey = clientIp(request);
  if (isLoginRateLimited(limitKey)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: NO_STORE }
    );
  }

  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    recordLoginFailure(limitKey);
    // One generic message for unknown email and wrong password alike —
    // arbitrary addresses cannot be probed for existing accounts.
    return NextResponse.json(
      {
        ok: false,
        error:
          result.reason === "error"
            ? "We couldn't sign you in right now. Please try again."
            : "Invalid email or password.",
      },
      { status: 401, headers: NO_STORE }
    );
  }

  // A valid Supabase login is NOT authorization: the identity must also be in
  // the server-side owner allowlist. Otherwise the session is revoked at once
  // and no booking data is ever returned.
  if (!isOwnerEmail(result.user.email)) {
    await revokeSession(result.tokens.accessToken);
    return NextResponse.json(
      { ok: false, error: "This account does not have access to the dashboard." },
      { status: 403, headers: NO_STORE }
    );
  }

  clearLoginFailures(limitKey);

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  applySessionCookies(response, result.tokens, request);
  return response;
}
