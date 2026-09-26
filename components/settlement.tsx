"use client";

import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n/react";
import type { RoomView } from "@/lib/game";
import { MvpVote } from "./mvp-vote";

type Act = (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;

export function Settlement({ room, busy, act, onClose }: { room: RoomView; busy: boolean; act: Act; onClose: () => void }) {
  const { t } = useI18n();
  const winner = room.game?.result?.winner;
  return <div className="settlement-layer">
    <section className="settlement" role="dialog" aria-label={t("本局结算")}>
      <span className="result-emblem"><Trophy size={32} strokeWidth={1.3} aria-hidden="true" /></span>
      <h2>{winner === "good" ? t("正义守住了圆桌。") : t("暗影笼罩了圆桌。")}</h2>
      {room.game?.mvp ? <MvpVote room={room} busy={busy} act={act} /> : <p>{t("登录后才能给己方投票。")}</p>}
      <button type="button" className="primary-button" onClick={onClose}>{t("看复盘")}</button>
    </section>
  </div>;
}
