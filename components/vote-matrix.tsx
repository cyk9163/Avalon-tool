"use client";

import { Check, Crown, X } from "lucide-react";
import type { GameView, RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { seatStats } from "@/lib/seat-stats";

/**
 * Team votes as a compact matrix (v1.7): one row per proposal, one column
 * per seat, so it fits a phone without sideways scrolling. Each cell shows
 * approve/reject with an icon (not colour alone) and a gold frame when that
 * seat was on the proposed team. Below it, simple per-seat statistics.
 */
export function VoteMatrix({ room, game }: { room: RoomView; game: GameView }) {
  const { t } = useI18n();
  const seats = [...room.players].sort((a, b) => a.seat - b.seat);
  const stats = seatStats(room, game);
  const name = (seat: number) => room.players.find(player => player.seat === seat)?.name || t("{n} 号", { n: seat });
  return (
    <div className="vote-matrix-block">
      <div className="vote-matrix-wrap">
        <table className="vote-matrix" style={{ ["--seats" as string]: seats.length }}>
          <caption className="sr-only">{t("每一车的队长、队员和每位玩家的表决")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("车")}</th>
              {seats.map(player => <th scope="col" key={player.id} title={player.name}>{player.seat}</th>)}
              <th scope="col">{t("结果")}</th>
            </tr>
          </thead>
          <tbody>
            {game.proposals.map(proposal => (
              <tr key={proposal.id} className={proposal.approved ? "approved" : "rejected"}>
                <th scope="row">{proposal.quest}·{proposal.attempt}</th>
                {seats.map(player => {
                  const vote = proposal.votes.find(item => item.seat === player.seat);
                  const onTeam = proposal.team.includes(player.seat);
                  const leader = proposal.leaderSeat === player.seat;
                  const state = vote ? (vote.approve ? t("赞成") : t("反对")) : t("未表决");
                  return (
                    <td key={player.id} className={`${vote ? (vote.approve ? "yes" : "no") : ""}${onTeam ? " on-team" : ""}`}
                      aria-label={[t("{n} 号", { n: player.seat }), state, onTeam ? t("在车上") : "", leader ? t("队长") : ""].filter(Boolean).join(t("，"))}>
                      {leader && <Crown className="matrix-leader" size={10} aria-hidden="true" />}
                      {vote ? (vote.approve ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />) : "·"}
                    </td>
                  );
                })}
                <td className="matrix-result">{proposal.approved ? t("通过") : t("否决")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="matrix-legend"><span><Check size={12} aria-hidden="true" />{t("赞成")}</span><span><X size={12} aria-hidden="true" />{t("反对")}</span><span className="legend-team">{t("金框：在车上")}</span><span><Crown size={11} aria-hidden="true" />{t("队长")}</span></p>
      <div className="seat-stats-wrap">
        <table className="seat-stats">
          <caption>{t("玩家统计")}</caption>
          <thead><tr><th scope="col">{t("玩家")}</th><th scope="col">{t("当队长")}</th><th scope="col">{t("被选上车")}</th><th scope="col">{t("出任务")}</th><th scope="col">{t("赞成率")}</th></tr></thead>
          <tbody>
            {stats.map(row => (
              <tr key={row.seat}>
                <th scope="row"><b>{row.seat}</b> {name(row.seat)}</th>
                <td>{row.led}</td>
                <td>{row.picked}</td>
                <td>{row.played}</td>
                <td>{row.votes ? `${Math.round(row.approvals / row.votes * 100)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
