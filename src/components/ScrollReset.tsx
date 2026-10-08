"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const HOMEPAGE = "/";

// Module scope on purpose: the homepage unmounts while a service page owns
// the screen, so the saved positions and the "arrived via Back / Forward"
// signal have to outlive the component instance. A full page load resets them,
// which is what keeps a refresh landing on the Hero.
const savedByPath = new Map<string, number>();
let historyPath: string | null = null;
let pendingRestore: { path: string; y: number } | null = null;
// Path sealed by a link click. Scroll events on it during the commit are the
// router's own scroll-to-top, not the visitor's position, so they must not
// overwrite what the click already captured. Cleared on every popstate.
let sealedPath: string | null = null;
let popStateAttached = false;
let clickCaptureAttached = false;
let scrollAttached = false;

function scrollTo(y: number) {
  window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
}

function handleScroll() {
  const path = window.location.pathname;
  if (path === sealedPath) return;
  savedByPath.set(path, window.scrollY);
}

function handlePopState() {
  // Fires before React commits the restored route, so the target position is
  // captured here — a scroll triggered while the route re-renders would
  // otherwise clobber the value we are about to restore.
  const path = window.location.pathname;
  historyPath = path;
  pendingRestore = { path, y: savedByPath.get(path) ?? 0 };
  sealedPath = null;

  if (path === HOMEPAGE) return;

  // No component of ours is mounted on other routes, so Back/Forward there is
  // handled right here: without it the browser just clamps the outgoing
  // scroll offset, leaving the visitor mid-page or at the bottom.
  const y = savedByPath.get(path) ?? 0;
  requestAnimationFrame(() => {
    if (window.location.pathname !== path) return;
    scrollTo(y);
  });
}

function pathOf(href: string): string | null {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function isInAppNavigation(): boolean {
  // The URL the *document* was loaded with. If it still matches the current
  // URL this is a fresh load (or a refresh); if it doesn't, the router has
  // since moved us here — including cases where ScrollReset was not mounted
  // when the click happened, so no listener of ours could have recorded it.
  const nav = performance.getEntriesByType("navigation")[0];
  if (!nav) return false;
  return nav.name !== window.location.href;
}

function handleCaptureClick(event: MouseEvent) {
  // Snapshot the current position *before* the router navigates — Next.js
  // scrolls during the commit, after which the real position is gone.
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor) return;
  if (anchor.target && anchor.target !== "_self") return;

  const href = anchor.getAttribute("href");
  if (!href) return;

  const targetPath = pathOf(href);
  if (!targetPath) return;
  // Same-path links are in-page/hash navigation — keep recording normally.
  if (targetPath === window.location.pathname) return;

  const currentPath = window.location.pathname;
  savedByPath.set(currentPath, window.scrollY);
  sealedPath = currentPath;
  // This is a push, not a Back/Forward. Drop any leftover popstate signal
  // (a hash-only jump or a Forward to another route sets one) so the homepage
  // cannot mistake this arrival for a history restore.
  historyPath = null;
  pendingRestore = null;
}

function attachGlobalListeners() {
  if (typeof window === "undefined") return;

  // Deliberately never removed: all three must stay live while a service page
  // owns the screen, otherwise returning by Back/Forward would look exactly
  // like a fresh visit.
  if (!popStateAttached) {
    popStateAttached = true;
    window.addEventListener("popstate", handlePopState);
  }
  if (!clickCaptureAttached) {
    clickCaptureAttached = true;
    window.addEventListener("click", handleCaptureClick, true);
  }
  if (!scrollAttached) {
    scrollAttached = true;
    window.addEventListener("scroll", handleScroll, { passive: true });
  }
}

// Ensure the homepage always loads at the top (Hero first). Browser refresh
// must not restore a previous internal-section scroll position or hash — but
// browser Back/Forward must return the visitor to exactly where they left off.
export default function ScrollReset() {
  const pathname = usePathname();
  const handledFor = useRef<string | null>(null);

  useEffect(() => {
    attachGlobalListeners();
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // This component only ever exists on the homepage; other routes are covered
  // by handlePopState above.
  useEffect(() => {
    if (pathname !== HOMEPAGE) {
      handledFor.current = pathname;
      return;
    }

    // React StrictMode invokes this effect twice on mount. Without this guard
    // the second pass would consume the flag and scroll straight back to the
    // top, undoing the restore.
    if (handledFor.current === pathname) return;
    handledFor.current = pathname;

    const isBackForward = historyPath === pathname && pendingRestore?.path === pathname;
    const restoreY = pendingRestore?.y ?? null;
    // Read before anything below mutates the URL.
    const inAppNavigation = isInAppNavigation();
    historyPath = null;
    pendingRestore = null;
    sealedPath = null;

    if (isBackForward && restoreY !== null) {
      scrollTo(restoreY);
      return;
    }

    if (inAppNavigation && window.location.hash) {
      // Arrived here through the router via "/#services" — honour the anchor.
      // A fresh load or a refresh still matches the document URL, so the hash
      // is stripped below exactly as before.
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) {
        target.scrollIntoView({ behavior: "instant", block: "start" });
        return;
      }
    }

    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    scrollTo(0);
  }, [pathname]);

  return null;
}
