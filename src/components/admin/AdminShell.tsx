import Link from "next/link";
import AdminNav from "./AdminNav";
import LogoutButton from "./LogoutButton";

// Chrome for the private owner dashboard. Deliberately separate from the
// public navbar/footer (which live in the (public) route group) and it never
// appears on any customer-facing page.
export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-primary focus:text-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="bg-primary-deep text-ivory">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-display text-lg leading-none sm:text-xl">
              Shri Sai Vatika
            </Link>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold-muted">
              Owner Dashboard
            </span>
          </div>

          <AdminNav />

          <div className="ml-auto flex items-center gap-3">
            <span className="text-small hidden text-ivory/75 lg:inline">{email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main id="admin-main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border py-4">
        <p className="mx-auto max-w-6xl px-4 text-small text-muted-foreground sm:px-6">
          Private owner area — not linked from the public website.
        </p>
      </footer>
    </div>
  );
}
