/** Accepts only same-site admin paths, so ?next= can never leave the app. */
export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (!value.startsWith("/admin")) return fallback;
  return value;
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
