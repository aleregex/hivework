"use client";

import { useEffect, useState } from "react";

/**
 * Reads `?demo=1` (or `?demo=true`) from the URL on mount and listens for
 * subsequent navigations. Returns true when we're in presenter mode — the
 * Demo Control Panel renders only when this is true so it doesn't pollute
 * the regular UX for influencers / brands.
 */
export function useDemoMode(): boolean {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const read = () => {
      const v = new URLSearchParams(window.location.search).get("demo");
      setDemo(v === "1" || v === "true");
    };
    read();
    // Some parts of next routing don't fire popstate; fall back to a tick.
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  return demo;
}
