"use client";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { usePlayerNotes } from "@/lib/player-notes";
import { MarkTag } from "@/components/player-notes";

const PLAY_PHASES = ["team", "vote", "quest", "lake"];

/**
 * The assassin's one-time strike under the anytime-assassin rule. Rendered only
 * on the assassin's own device, inside the private (collapsed) identity area,
 * so a glance at the screen does not give the role away.
 */
export function EarlyAssassination({ room, busy, connected, act }: {
  room: RoomView; busy: boolean; connected: boolean;
  act: (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;
}) {
  const { t } = useI18n();
  const { notes } = usePlayerNotes(room.code, room.round, room.roles);
  const [open, setOpen] = useState(false), [target, setTarget] = useState<number | null>(null), [confirming, setConfirming] = useState(false);
  // Leaving the page closes the dialog and forgets the choice.
  useEffect(() => {
    const hide = () => { if (document.hidden) { setOpen(false); setTarget(null); setConfirming(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  if (!room.anytimeAssassin || room.identity?.role !== "assassin" || !room.game || !PLAY_PHASES.includes(room.phase)) return null;
  const me = room.players.find(player => player.id === room.meId);
  const others = room.players.filter(player => player.id !== room.meId).sort((a, b) => a.seat - b.seat);
  const close = () => { setOpen(false); setTarget(null); setConfirming(false); };
  const strike = async () => {
    if (target === null || !room.game) return;
    const result = await act("assassinate", { turnId: room.game.turnId, targetSeat: target });
    if (result) close();
  };
  return (
    <div className="early-strike">
      <button type="button" className="secondary-button wide early-strike-open" disabled={busy || !connected || !me} onClick={() => setOpen(true)}><Swords size={17} />{t("出刀刺杀")}</button>
      <p className="action-note">{t("本局规则：刺客可以随时出刀，但只有一次。刺中梅林邪恶立即获胜，刺错正义立即获胜。")}</p>
      <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="early-strike-dialog">
          <DialogTitle>{t("选择你认为是梅林的人")}</DialogTitle>
          <DialogDescription>{t("出刀后本局立即结束，不能撤回。")}</DialogDescription>
          <div className="early-strike-seats" role="radiogroup" aria-label={t("刺杀目标")}>
            {others.map(player => (
              <button key={player.id} type="button" role="radio" aria-checked={target === player.seat} className={target === player.seat ? "selected" : undefined} onClick={() => { setTarget(player.seat); setConfirming(false); }}>
                <strong>{t("{n} 号", { n: player.seat })}</strong><span>{player.name}</span><MarkTag mark={notes.marks[player.seat]} />
              </button>
            ))}
          </div>
          {!confirming
            ? <button type="button" className="primary-button" disabled={target === null} onClick={() => setConfirming(true)}>{t("下一步")}</button>
            : <div className="early-strike-confirm">
                <p>{t("确定刺杀 {n} 号？刺中梅林邪恶获胜，刺错正义获胜。", { n: target ?? "" })}</p>
                <button type="button" className="primary-button assassination-button" disabled={busy || !connected} onClick={() => void strike()}><Swords size={17} />{busy ? t("正在提交…") : t("确认出刀")}</button>
                <button type="button" className="text-button" onClick={() => setConfirming(false)}>{t("再想一下")}</button>
              </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
