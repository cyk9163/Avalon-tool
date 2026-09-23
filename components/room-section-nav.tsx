"use client";

import { useEffect, useMemo, useState } from "react";
import { History, LockKeyhole, NotebookPen, Swords, type LucideIcon } from "lucide-react";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";

type Section = { id: string; label: string; Icon: LucideIcon };
const SECTIONS: readonly Section[] = [
  { id: "room-game", label: msg("对局"), Icon: Swords },
  { id: "room-identity", label: msg("我的身份"), Icon: LockKeyhole },
  { id: "room-notes", label: msg("笔记"), Icon: NotebookPen },
  { id: "room-log", label: msg("记录"), Icon: History },
];

/**
 * Sticky section tabs for phones during a game: one tap jumps to the game,
 * my identity, my notes or the game log, opening a collapsed section on the
 * way. Presentation only — it never changes game state.
 */
export function RoomSectionNav({ showNotes, connected, live }: { showNotes: boolean; connected: boolean; live: boolean }) {
  const { t } = useI18n();
  const sections = useMemo(() => SECTIONS.filter(section => showNotes || section.id !== "room-notes"), [showNotes]);
  const [active, setActive] = useState(sections[0].id);

  // Highlight the last section whose top has passed under the bar, so a
  // section nested in another (the game log inside the game) still wins.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 96;
      const passed = sections
        .map(section => ({ id: section.id, el: document.getElementById(section.id) }))
        .filter((item): item is { id: string; el: HTMLElement } => !!item.el)
        .sort((a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top)
        .filter(item => item.el.getBoundingClientRect().top <= line);
      setActive(passed.at(-1)?.id ?? sections[0].id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [sections]);

  const go = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav className="room-section-nav" aria-label={t("房间分区")}>
      {sections.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={active === id ? "active" : undefined} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>
          <Icon size={15} aria-hidden="true" />{t(label)}
        </button>
      ))}
      <span className={`room-section-status${connected ? live ? " live" : "" : " offline"}`} role="status" title={connected ? live ? t("实时连接：其他人的操作会立即显示") : t("定时同步：每隔几秒刷新一次") : t("重连中")} aria-label={connected ? live ? t("实时") : t("已同步") : t("重连中")}>
        <i aria-hidden="true" />{!connected && t("重连中")}
      </span>
    </nav>
  );
}
