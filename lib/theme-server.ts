import { cookies } from "next/headers";
import { THEME_COOKIE, pickTheme, type Theme } from "./theme";

export async function serverTheme(): Promise<Theme> {
  return pickTheme((await cookies()).get(THEME_COOKIE)?.value);
}
