"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { GameTable } from "@/components/game-table";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { replaySteps, tableSnapshot, type ReplayStep } from "@/lib/replay-steps";

/** Step through a finished game on the round table. Members only. */
export function ReplayTimeline({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const me = room.players.find(player => player.id === room.meId);
  const game = room.game;
  const steps = replaySteps(game, me?.seat ?? null);
  const [index, setIndex] = useState(0);
  if (!game || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  const snapshot = tableSnapshot(step);
  const playerName = (seat: number) => room.players.find(player => player.seat === seat)?.name ?? t("玩家");
  const label = (seat: number) => t("{n} 号 · {name}", { n: seat, name: playerName(seat) });
  const seats = (list: number[]) => list.map(label).join(t("、"));
  const go = (next: number) => setIndex(Math.max(0, Math.min(steps.length - 1, next)));

  return <section className="replay-timeline" aria-label={t("回放")}>
    <h3>{t("回放")}</h3>
    <div className="game-table-wrap"><GameTable room={room} game={game} marks={{}} replay={snapshot} /></div>
    <p className="replay-score">{t("当时比分：正义 {good}，邪恶 {evil}", { good: step.good, evil: step.evil })}</p>
    <ol className="quest-track" aria-label={t("五次任务进度")}>
      {[1, 2, 3, 4, 5].map(number => {
        const done = step.completed.find(item => item.quest === number);
        const current = !done && step.quest === number;
        return <li key={number} className={`${done ? done.success ? "success" : "failure" : ""} ${current ? "current" : ""}`}>
          <span className="quest-step-label">{t("任务 {n}", { n: number })}</span>
          <span className="quest-step-symbol" aria-hidden="true">{done ? done.success ? <Check size={19} /> : <X size={19} /> : null}</span>
          <strong>{done ? done.success ? t("成功") : t("失败") : current ? t("当前") : t("待开始")}</strong>
          {done && <small>{t("{n} 张失败", { n: done.failCount })}</small>}
        </li>;
      })}
    </ol>
    <p className="replay-caption">{caption(step, t, seats, label)}</p>
    <div className="replay-controls">
      <button type="button" className="secondary-button" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft size={16} aria-hidden="true" />{t("上一步")}</button>
      <input type="range" min={0} max={steps.length - 1} value={index} aria-label={t("回放进度")} onChange={event => go(Number(event.target.value))} />
      <button type="button" className="secondary-button" disabled={index === steps.length - 1} onClick={() => go(index + 1)}>{t("下一步")}<ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    <p className="replay-step-count">{t("第 {n} 步，共 {total} 步", { n: index + 1, total: steps.length })}</p>
  </section>;
}

function caption(step: ReplayStep, t: (zh: string, vars?: Record<string, string | number>) => string, seats: (list: number[]) => string, label: (seat: number) => string) {
  if (step.kind === "proposal") {
    const yes = step.votes.filter(vote => vote.approve).map(vote => vote.seat);
    const no = step.votes.filter(vote => !vote.approve).map(vote => vote.seat);
    return <>
      {t("任务 {quest} 第 {attempt} 车：队长 {leader}，队员 {team}，{outcome}。", {
        quest: step.quest, attempt: step.attempt, leader: label(step.leaderSeat), team: seats(step.team), outcome: step.approved ? t("通过") : t("否决"),
      })}
      <small>{t("赞成 {yes}，反对 {no}。", { yes: yes.length ? seats(yes) : t("无"), no: no.length ? seats(no) : t("无") })}</small>
    </>;
  }
  if (step.kind === "quest") {
    const cards = step.cards?.map(({ seat, card }) => t("{player} {card}", { player: label(seat), card: card === "fail" ? t("失败") : t("成功") })).join(t("、"));
    return <>
      {t("任务 {quest} {outcome}，失败 {f} 张。", { quest: step.quest, outcome: step.success ? t("成功") : t("失败"), f: step.failCount })}
      {cards ? <small>{t("出牌：{cards}", { cards })}</small> : null}
    </>;
  }
  return t("湖中仙女：{from} 把令牌交给 {to}。查验结果仍只有查验者自己看得到。", { from: label(step.fromSeat), to: label(step.toSeat) });
}
