"use client";

import { useEffect } from "react";

// Ensure the homepage always loads at the top (Hero first). Browser refresh
// must not restore a previous internal-section scroll position or hash.
export default function ScrollReset() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return null;
}
