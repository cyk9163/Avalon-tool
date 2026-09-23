"use client";

import { Trophy } from "lucide-react";
import type { RoomView } from "@/lib/game";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";
import { roomRecord } from "@/lib/room-record";

const reasonShort = {
  "three-failures": msg("三次任务失败"),
  "five-rejections": msg("连续五次否决"),
  "merlin-assassinated": msg("刺中梅林"),
  "assassin-missed": msg("刺杀落空"),
};

/**
 * Same-room record (v1.9): wins per player and per side across the games
 * played in this room, plus one line per game. Only games you played in.
 * Hidden on the first game's result screen, where it would repeat the result.
 */
export function RoomRecord({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const history = room.history;
  if (!history.length || (room.phase === "finished" && history.length < 2)) return null;
  const record = roomRecord(history);
  const rate = (wins: number, games: number) => games ? `${wins}/${games}` : "—";
  return (
    <section className="room-record" aria-label={t("同房战绩")}>
      <div className="room-record-head">
        <span className="room-record-title"><Trophy size={16} aria-hidden="true" />{t("同房战绩")}</span>
        <span>{t("{n} 局 · 正义胜 {good} · 邪恶胜 {evil}", { n: record.games, good: record.goodWins, evil: record.evilWins })}</span>
      </div>
      <div className="room-record-table-wrap">
        <table className="room-record-table">
          <thead><tr><th scope="col">{t("玩家")}</th><th scope="col">{t("胜 / 局")}</th><th scope="col">{t("正义")}</th><th scope="col">{t("邪恶")}</th><th scope="col">{t("梅林被刺")}</th></tr></thead>
          <tbody>
            {record.players.map(row => (
              <tr key={row.id} className={row.id === room.meId ? "mine" : undefined}>
                <th scope="row"><b>{row.seat}</b> {row.name}</th>
                <td>{row.wins} / {row.games}</td>
                <td>{rate(row.goodWins, row.goodGames)}</td>
                <td>{rate(row.evilWins, row.evilGames)}</td>
                <td>{row.merlinGames ? `${row.merlinFound}/${row.merlinGames}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="room-record-games">
        {[...history].reverse().map(game => (
          <li key={game.round}>
            <span>{t("第 {n} 局", { n: game.round })}</span>
            <strong className={game.winner === "good" ? "vote-yes" : "vote-no"}>{game.winner === "good" ? t("正义胜") : t("邪恶胜")}</strong>
            <small>{t(reasonShort[game.reason])}</small>
          </li>
        ))}
      </ol>
      <p className="action-note">{t("「正义」「邪恶」列为该阵营的胜场 / 场数；只统计你参与的对局，房间过期后清除。")}</p>
    </section>
  );
}
