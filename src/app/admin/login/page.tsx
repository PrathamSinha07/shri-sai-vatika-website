import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { ADMIN_LOGOUT_PATH, getSessionCheck } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Owner Sign In",
  robots: { index: false, follow: false },
};

// Publicly reachable sign-in page for the private dashboard. There is no
// signup: owner accounts are provisioned privately in Supabase.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; expired?: string }>;
}) {
  const params = await searchParams;
  const check = await getSessionCheck();

  // Already an authorized owner → straight to the dashboard.
  if (check.state === "authorized") redirect("/admin");
  // Authenticated but not an owner: drop the session before rendering.
  if (check.state === "unauthorized") {
    redirect(`${ADMIN_LOGOUT_PATH}?next=${encodeURIComponent("/admin/login?denied=1")}`);
  }

  const denied = params.denied === "1";
  const expired = params.expired === "1";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="eyebrow">Shri Sai Vatika</p>
          <h1 className="font-display mt-3 text-3xl text-primary-deep">Owner Sign In</h1>
          <p className="text-small mt-3 text-muted-foreground">
            Private access for the venue owner and authorised staff.
          </p>
        </div>

        <div className="mt-8 rounded-panel border border-border bg-surface p-6 shadow-sm sm:p-8">
          {denied ? (
            <p
              role="alert"
              className="mb-6 rounded-control border border-[#e3bbbb] bg-[#f8e7e7] px-3 py-2 text-small text-[#8a2222]"
            >
              This account does not have access to the dashboard. Ask the site
              owner to grant access, then sign in again.
            </p>
          ) : null}
          {expired ? (
            <p
              role="status"
              className="mb-6 rounded-control border border-gold-muted bg-gold-muted/30 px-3 py-2 text-small text-[#6b4d0f]"
            >
              Your session has expired. Please sign in again.
            </p>
          ) : null}

          <LoginForm />
        </div>

        <p className="text-small mt-6 text-center text-muted-foreground">
          <Link href="/" className="underline underline-offset-4 hover:text-primary">
            Back to the public website
          </Link>
        </p>
      </div>
    </div>
  );
}
