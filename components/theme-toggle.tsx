"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/react";
import { THEME_COLORS, THEME_COOKIE, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: "dark", setTheme: () => {} });

/** Holds the colour theme the server rendered with (from the cookie), so the first render matches. */
export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);
  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    if (next === "light") root.dataset.theme = "light"; else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[next]);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setThemeState(next);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Switches between the dark theme and the light one for bright rooms (v1.11). */
export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useContext(ThemeContext);
  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button type="button" className="lang-toggle theme-toggle" onClick={() => setTheme(next)} aria-label={next === "light" ? t("切换到浅色主题") : t("切换到深色主题")}>
      {next === "light" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
