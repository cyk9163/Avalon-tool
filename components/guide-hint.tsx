"use client";

import { useSyncExternalStore } from "react";
import { Lightbulb, X } from "lucide-react";
import type { RoomView } from "@/lib/game";
import { guideHint } from "@/lib/guide";
import { useI18n } from "@/lib/i18n/react";

const KEY = "avalon:guide";
const listeners = new Set<() => void>();
function read(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
function setGuide(on: boolean) {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, "off"); } catch { /* Private mode: this session only. */ }
  listeners.forEach(listener => listener());
}
/** Whether this device shows beginner hints (on unless turned off here). Hidden during server rendering. */
export function useGuide(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/**
 * Beginner hint (v1.11): one line at the top of the room telling this player
 * what to do right now. Can be turned off here and back on in the help dialog.
 */
export function GuideHint({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const on = useGuide();
  const hint = guideHint(room);
  if (!on || !hint) return null;
  return (
    <div className="guide-hint" role="note">
      <Lightbulb size={16} aria-hidden="true" />
      <p>{t(hint.text, hint.vars)}</p>
      <button type="button" className="guide-hint-close" onClick={() => setGuide(false)} aria-label={t("关闭新手提示")}><X size={15} aria-hidden="true" /></button>
    </div>
  );
}

/** The switch in the help dialog. */
export function GuideSwitch() {
  const { t } = useI18n();
  const on = useGuide();
  return (
    <label className="guide-switch">
      <input type="checkbox" checked={on} onChange={event => setGuide(event.target.checked)} />
      <span>{t("显示新手提示（每一步该做什么）")}</span>
    </label>
  );
}
