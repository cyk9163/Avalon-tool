// Colour theme (v1.11): dark by default, light for bright rooms. The choice
// is a plain cookie (only "light" or "dark"), so the server renders the page
// in the right theme without a flash.
export type Theme = "dark" | "light";
export const THEME_COOKIE = "avalon_theme";
export const THEME_COLORS: Record<Theme, string> = { dark: "#0c171a", light: "#f0f4f6" };

export function pickTheme(cookie: string | null | undefined): Theme {
  return cookie === "light" ? "light" : "dark";
}
