"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks, bookVisitHref } from "@/content/navigation";
import { services } from "@/content/services";
import { site } from "@/content/site";
import { whatsappUrl, defaultEnquiryMessage } from "@/lib/whatsapp";
import { googleMapsDirectionsUrl } from "@/lib/maps";

// Services the client has confirmed and that already have their own page —
// the footer reuses those routes rather than inventing new destinations.
const serviceLinks = services.map((service) => ({
  label: service.title,
  href: `/services/${service.slug}`,
}));

const linkClass =
  "text-small text-ivory/75 transition-colors hover:text-gold-rich focus-visible:text-gold-rich";

export default function SiteFooter() {
  const pathname = usePathname();
  // Hash-only links would do nothing on other routes (e.g. service pages).
  const sectionHref = (hash: string) =>
    pathname === "/" ? hash : `/${hash}`;

  return (
    <footer className="bg-primary-deep text-ivory">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <div className="grid gap-10 sm:grid-cols-2 md:gap-12 lg:grid-cols-[1.6fr_1fr_1.2fr_1.3fr]">
          {/* Brand */}
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Image
              src="/logo.png"
              alt={`${site.name} logo`}
              width={800}
              height={533}
              className="h-auto w-40"
            />
            <p className="font-display mt-5 text-2xl leading-snug text-gold-rich">
              {site.tagline}
            </p>
            <p className="text-body mt-4 text-ivory/75">
              An air-conditioned banquet hall and a spacious lawn on Gola Road,
              Danapur — hosting weddings and family celebrations in Patna.
            </p>
          </div>

          {/* Explore */}
          <nav aria-label="Explore">
            <h2 className="footer-heading">Explore</h2>
            <ul className="mt-5 flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={sectionHref(link.href)} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={sectionHref(bookVisitHref)} className={linkClass}>
                  Plan Your Visit
                </Link>
              </li>
            </ul>
          </nav>

          {/* Celebrations */}
          <nav aria-label="Celebrations">
            <h2 className="footer-heading">Celebrations</h2>
            <ul className="mt-5 flex flex-col gap-3">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h2 className="footer-heading">Contact</h2>
            <address className="mt-5 not-italic">
              <p className="text-small leading-relaxed text-ivory/75">
                {site.address.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <p className="mt-4">
                <a href={site.phoneHref} className="font-display text-xl text-ivory transition-colors hover:text-gold-rich">
                  {site.phoneDisplay}
                </a>
              </p>
            </address>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <a
                  href={whatsappUrl(defaultEnquiryMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  WhatsApp us
                </a>
              </li>
              <li>
                <a
                  href={googleMapsDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Get Directions
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-ivory/15 pt-5 text-small text-ivory/55">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
