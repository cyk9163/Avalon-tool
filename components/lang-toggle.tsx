"use client";

import { Languages } from "lucide-react";
import { native } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";

/**
 * Switches between Chinese and English. Client screens update in place;
 * server-rendered reading pages pass `reload` to re-render in the new language.
 */
export function LangToggle({ reload = false }: { reload?: boolean }) {
  const { lang, setLang } = useI18n();
  const next = lang === "en" ? "zh" : "en";
  return (
    <button
      type="button"
      className="lang-toggle"
      lang={next === "en" ? "en" : "zh-CN"}
      aria-label={next === "en" ? "Switch to English" : native("切换到中文")}
      onClick={() => { setLang(next); if (reload) location.reload(); }}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{next === "en" ? "EN" : native("中文")}</span>
    </button>
  );
}
