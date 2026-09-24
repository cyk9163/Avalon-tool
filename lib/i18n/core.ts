// Chinese / English interface text (v1.0). Chinese source strings are the
// keys: t("建立房间") returns the English entry when the language is English and
// the Chinese text otherwise, so a missing entry degrades to Chinese instead of
// a blank. Variables use {name} placeholders: t("还差 {n} 位", { n: 2 }).
// Text that arrives from the server (errors, identity clues) goes through
// translateServer(), which also matches entries with {0}, {1} placeholders.
// tests/i18n.test.mjs checks that every key used in the code has an entry.
import { EN } from "./dictionary.ts";

export type Lang = "zh" | "en";
export type Vars = Record<string, string | number>;
export const LANGS: readonly Lang[] = ["zh", "en"];
export const LANG_COOKIE = "avalon_lang";

/** Marks a translatable literal kept outside a component (module constants). Returns it unchanged. */
export function msg(text: string): string {
  return text;
}

/** Text that always shows in its own language (e.g. the language switch label). Returns it unchanged. */
export function native(text: string): string {
  return text;
}

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}

export function translate(lang: Lang, zh: string, vars?: Vars): string {
  return format(lang === "en" ? EN[zh] ?? zh : zh, vars);
}

/** The saved choice wins. With no choice, the interface is Chinese, whatever the browser language is. */
export function pickLang(cookie: string | null | undefined, _acceptLanguage?: string | null): Lang {
  if (cookie === "zh" || cookie === "en") return cookie;
  return "zh";
}

// Longest fixed text first, so a specific message wins over a generic one.
type Pattern = { regex: RegExp; en: string; length: number };
let patterns: Pattern[] | null = null;
function escape(text: string) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function serverPatterns(): Pattern[] {
  if (!patterns) {
    patterns = Object.entries(EN).filter(([zh]) => /\{\d+\}/.test(zh)).map(([zh, en]) => ({
      regex: new RegExp(`^${zh.split(/\{\d+\}/).map(escape).join("(.+?)")}$`),
      en,
      length: zh.replace(/\{\d+\}/g, "").length,
    })).sort((a, b) => b.length - a.length);
  }
  return patterns;
}

/** Translates a message produced by the server, including ones with inserted values. */
export function translateServer(lang: Lang, message: string): string {
  if (lang !== "en" || !message) return message;
  const trimmed = message.trim();
  if (EN[trimmed]) return EN[trimmed];
  for (const { regex, en } of serverPatterns()) {
    const match = trimmed.match(regex);
    if (!match) continue;
    // Inserted values can themselves be translatable (role names, sides).
    return en.replace(/\{(\d+)\}/g, (_, index: string) => { const value = match[Number(index) + 1] ?? ""; return EN[value] ?? value; });
  }
  return message;
}
