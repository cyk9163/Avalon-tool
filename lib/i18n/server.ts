// Language for server-rendered pages: the saved choice, otherwise Chinese.
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, translate, type Lang, type Vars } from "./core";

export async function serverLang(): Promise<Lang> {
  const [jar, list] = await Promise.all([cookies(), headers()]);
  return pickLang(jar.get(LANG_COOKIE)?.value, list.get("accept-language"));
}

/** A t() bound to one language, for server components. */
export function serverT(lang: Lang) {
  return (zh: string, vars?: Vars) => translate(lang, zh, vars);
}
