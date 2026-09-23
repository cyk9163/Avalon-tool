"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LANG_COOKIE, translate, translateServer, type Lang, type Vars } from "./core";
import { EN } from "./dictionary";

type Translate = ((zh: string, vars?: Vars) => string);
type I18n = {
  lang: Lang;
  /** Interface text: t("建立房间"), t("还差 {n} 位", { n }). */
  t: Translate;
  /** Text that came from the server (errors, identity clues). */
  ts: (message: string) => string;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18n>({
  lang: "zh",
  t: (zh, vars) => translate("zh", zh, vars),
  ts: message => message,
  setLang: () => {},
});

export function I18nProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    // Read by the server on the next request, so pages render in this language
    // without a flash. Not HttpOnly: it holds only "zh" or "en".
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    // The tab title was rendered by the server in the old language.
    const source = Object.entries(EN).find(([zh, en]) => document.title === zh || document.title === en)?.[0];
    if (source) document.title = translate(next, source);
  }, []);
  const value = useMemo<I18n>(() => ({
    lang,
    t: (zh, vars) => translate(lang, zh, vars),
    ts: message => translateServer(lang, message),
    setLang,
  }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
