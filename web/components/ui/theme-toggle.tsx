"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Pref = "light" | "dark";

const KEY = "hivework-theme";

function applyPref(pref: Pref) {
  document.documentElement.classList.toggle("theme-light", pref === "light");
  document.documentElement.dataset.themePref = pref;
  document.documentElement.dataset.theme = pref;
}

/**
 * Simple 2-state theme toggle (light / dark). Persists to localStorage.
 * The bootstrap script in `app/layout.tsx` already set the theme before paint,
 * so we just hydrate from `dataset.themePref`.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("dark");

  useEffect(() => {
    const fromHtml = (document.documentElement.dataset.themePref ??
      "dark") as Pref;
    setPref(fromHtml === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Pref = pref === "light" ? "dark" : "light";
    setPref(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
    applyPref(next);
  };

  const isLight = pref === "light";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark" : "Switch to light"}
      onClick={toggle}
      className="group relative inline-flex h-8 w-14 items-center rounded-full border border-line bg-surface p-0.5 transition-colors hover:border-line-strong"
    >
      {/* Track icons */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5">
        <Sun
          className={`h-3 w-3 transition-colors ${
            isLight ? "text-faint" : "text-muted"
          }`}
        />
        <Moon
          className={`h-3 w-3 transition-colors ${
            isLight ? "text-muted" : "text-faint"
          }`}
        />
      </span>
      {/* Thumb */}
      <span
        className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-honey text-ink shadow-[0_2px_8px_-2px_rgb(var(--honey-rgb)/0.6)] transition-transform duration-200 ease-out ${
          isLight ? "translate-x-0" : "translate-x-6"
        }`}
      >
        {isLight ? (
          <Sun className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <Moon className="h-3 w-3" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}
