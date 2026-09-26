"use client";

import { AvatarFace } from "@/components/avatar-face";
import { useI18n } from "@/lib/i18n/react";
import { ROLES, currentSide, type Role, type RoomView } from "@/lib/game";

type Act = (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;

export function MvpVote({ room, busy, act }: { room: RoomView; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const mvp = room.game?.mvp;
  const me = room.players.find(player => player.id === room.meId);
  const mine = room.game?.revealedRoles?.find(player => player.seat === me?.seat);
  if (!mvp || !mine || !me) return null;
  const sideOf = (role: Role) => currentSide({ game: room.game as unknown as Parameters<typeof currentSide>[0]["game"] }, { role });
  const choices = (room.game?.revealedRoles ?? []).filter(player => sideOf(player.role) === sideOf(mine.role));
  return <section className="mvp-vote">
    <h2>{t("投己方 MVP")}</h2>
    <p>{t("只能投给和你同一阵营的人，也可以投自己。票数最高且没有并列的人记一次 MVP。")}</p>
    <div className="mvp-choices">{choices.map(player => { const seated = room.players.find(item => item.seat === player.seat); return <button key={player.seat} type="button" className={mvp.myVote === player.seat ? "selected" : ""} disabled={busy} onClick={() => void act("mvp", { seat: player.seat })}><AvatarFace id={seated?.avatar} size={16} /><b>{player.seat}</b>{seated?.name} · {t(ROLES[player.role as Role].name)}</button>; })}</div>
    <ul className="mvp-tally">{mvp.winners.map(winner => { const seated = room.players.find(item => item.seat === winner.seat); const who = winner.seat ? `${winner.seat} ${seated?.name ?? ""}` : t("还没有"); return <li key={winner.side}>{winner.side === "good" ? t("好人 MVP：{who}", { who }) : t("坏人 MVP：{who}", { who })}</li>; })}</ul>
  </section>;
}
