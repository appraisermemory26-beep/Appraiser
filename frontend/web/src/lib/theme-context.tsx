"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Theme = "dark" | "light";
type ThemePreference = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  preference: "system",
  toggleTheme: () => {},
  setTheme: () => {},
  setPreference: () => {},
});

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("appraiser_theme") as string | null;
    if (stored === "light" || stored === "dark") {
      setPreferenceState(stored);
      setThemeState(stored);
    } else if (stored === "system" || !stored) {
      setPreferenceState("system");
      setThemeState(getSystemTheme());
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentPref = localStorage.getItem("appraiser_theme");
      if (!currentPref || currentPref === "system") {
        setThemeState(getSystemTheme());
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    setMounted(true);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, mounted]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setPreferenceState(next);
    setThemeState(next);
    localStorage.setItem("appraiser_theme", next);
  }

  function setTheme(t: Theme) {
    setPreferenceState(t);
    setThemeState(t);
    localStorage.setItem("appraiser_theme", t);
  }

  function setPreference(pref: ThemePreference) {
    setPreferenceState(pref);
    localStorage.setItem("appraiser_theme", pref);
    if (pref === "system") {
      setThemeState(getSystemTheme());
    } else {
      setThemeState(pref);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
