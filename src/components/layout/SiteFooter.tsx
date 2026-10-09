"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/content/navigation";
import { site } from "@/content/site";
import { whatsappUrl, defaultEnquiryMessage } from "@/lib/whatsapp";

export default function SiteFooter() {
  const pathname = usePathname();
  // Hash-only links would do nothing on other routes (e.g. service pages).
  const sectionHref = (hash: string) =>
    pathname === "/" ? hash : `/${hash}`;

  return (
    <footer className="bg-primary-deep text-ivory">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/logo.png"
              alt={`${site.name} logo`}
              width={800}
              height={533}
              className="h-auto w-40"
            />
            <p className="font-display mt-4 text-xl">{site.tagline}</p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={sectionHref(link.href)}
                    className="text-small text-ivory/80 transition-colors hover:text-gold-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <address className="not-italic text-small text-ivory/80">
            <p>{site.address.lines.join(", ")}</p>
            <p className="mt-3">
              <a href={site.phoneHref} className="hover:text-gold-muted">{site.phoneDisplay}</a>
            </p>
            <p className="mt-1">
              <a href={whatsappUrl(defaultEnquiryMessage)} target="_blank" rel="noopener noreferrer" className="hover:text-gold-muted">
                WhatsApp
              </a>
            </p>
          </address>
        </div>

        <p className="mt-10 border-t border-ivory/15 pt-4 text-small text-ivory/60">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
