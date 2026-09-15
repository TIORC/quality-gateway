"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "theme";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme());

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      className="flex items-center gap-2 rounded-lg border border-[#E9EEF5] px-3 py-2 text-[13px] font-medium text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#1E3A8A]"
    >
      {theme === "light" ? (
        <>
          <Moon className="h-4 w-4 shrink-0" />
          Modo escuro
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 shrink-0" />
          Modo claro
        </>
      )}
    </button>
  );
}
