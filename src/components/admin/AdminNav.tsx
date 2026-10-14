"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/bookings", label: "Bookings" },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="order-3 w-full sm:order-none sm:w-auto">
      <ul className="flex items-center gap-5">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-small inline-block border-b-2 py-1 transition-colors ${
                  active
                    ? "border-gold-rich text-ivory"
                    : "border-transparent text-ivory/75 hover:text-ivory"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
