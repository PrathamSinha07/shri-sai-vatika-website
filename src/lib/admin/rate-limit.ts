// Minimal in-memory failure limiter for the owner login form.
// It slows credential stuffing on a single instance; it is NOT a substitute
// for edge rate limiting (documented in docs/admin-dashboard.md).
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, { count: number; resetAt: number }>();

function entry(key: string, now = Date.now()) {
  const current = failures.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    failures.set(key, fresh);
    return fresh;
  }
  return current;
}

export function isLoginRateLimited(key: string, now = Date.now()): boolean {
  const current = failures.get(key);
  if (!current) return false;
  if (current.resetAt <= now) {
    failures.delete(key);
    return false;
  }
  return current.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const current = entry(key, now);
  current.count += 1;
  // Keep the map bounded even if keys are attacker-generated.
  if (failures.size > 5000) {
    for (const [k, v] of failures) {
      if (v.resetAt <= now) failures.delete(k);
    }
  }
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}
