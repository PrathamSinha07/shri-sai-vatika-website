"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks, bookVisitHref, virtualTourHref } from "@/content/navigation";
import { site } from "@/content/site";

export default function SiteHeader({ overlay }: { overlay?: boolean }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  // On other routes (e.g. service pages) hash-only links would do nothing —
  // point them back at the homepage section instead.
  const sectionHref = (hash: string) => (isHome ? hash : `/${hash}`);
  const transparentOverlay = overlay ?? isHome;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // The menu belongs to the route it was opened on: any navigation (link
  // click or Back/Forward) closes it, so it can never be left open over a
  // page it did not open on. Adjusting state during render is the React-
  // recommended way to respond to a value that changed underneath us.
  const [openedOnPath, setOpenedOnPath] = useState(pathname);
  if (open && openedOnPath !== pathname) {
    setOpenedOnPath(pathname);
    setOpen(false);
  }
  const openMenu = () => {
    setOpenedOnPath(pathname);
    setOpen(true);
  };
  const closeMenu = () => setOpen(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "Tab" && menuRef.current) {
        const focusables = menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
          scrolled
            ? "bg-background border-b border-border shadow-sm text-foreground"
            : transparentOverlay
              ? "bg-gradient-to-b from-primary-deep/50 via-primary-deep/10 to-transparent text-surface"
              : "bg-transparent text-primary-deep"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-6">
          <a href="#top" className="flex items-center gap-3" aria-label={`${site.name} — home`}>
            <Image
              src="/logo-mark.png"
              alt=""
              width={40}
              height={40}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full"
              priority
            />
            <span className="font-display text-xl leading-none whitespace-nowrap sm:text-2xl">
              {site.shortName}
            </span>
          </a>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={sectionHref(link.href)}
                    className="text-nav text-current opacity-90 transition-opacity hover:opacity-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Link
            href={sectionHref(virtualTourHref)}
            className={`btn-text hidden whitespace-nowrap lg:inline-flex ${scrolled || !transparentOverlay ? "btn-primary" : "btn-glass"}`}
          >
            Virtual Tour
          </Link>

          <button
            type="button"
            ref={triggerRef}
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center text-current"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={open ? closeMenu : openMenu}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>

      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[60] bg-background"
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <span className="font-display text-xl text-primary-deep">{site.shortName}</span>
            <button
              type="button"
              ref={closeRef}
              className="inline-flex h-11 w-11 items-center justify-center text-primary-deep"
              aria-label="Close menu"
              onClick={() => { closeMenu(); triggerRef.current?.focus(); }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Mobile" className="px-6 pt-8">
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={sectionHref(link.href)}
                    onClick={closeMenu}
                    className="font-display block border-b border-border py-3 text-2xl text-primary-deep"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="px-6 pt-8">
            <Link
              href={sectionHref(bookVisitHref)}
              onClick={closeMenu}
              className="btn-text btn-primary btn-block"
            >
              Plan Your Visit
            </Link>
            {/* The header's Virtual Tour CTA has no room in the compact bar —
                it lives here instead, with the same homepage-aware href as
                the desktop button (#gallery on /, /#gallery elsewhere). */}
            <Link
              href={sectionHref(virtualTourHref)}
              onClick={closeMenu}
              className="btn-text btn-outline btn-block mt-3"
            >
              Virtual Tour
            </Link>
            <p className="mt-4 text-small text-muted-foreground">
              {site.address.lines.join(", ")}
            </p>
            <a href={site.phoneHref} className="mt-1 block text-small text-primary">
              {site.phoneDisplay}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
