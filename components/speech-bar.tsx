"use client";

import { useEffect, useState } from "react";
import { Mic, RotateCcw, SkipForward, Timer } from "lucide-react";
import type { GameView, RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

const TIMER_CHOICES = [0, 60, 90, 120, 180] as const;

function clock(ms: number) {
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Speaking order and a soft timer while the leader builds a team (v1.8): the
 * leader speaks first, then round the table. The speaker taps「我说完了」; the
 * leader or host can skip an absent player, start another round, or change the
 * timer. Only a helper — nobody is ever forced to stop talking.
 */
export function SpeechBar({ room, game, blocked, act }: {
  room: RoomView;
  game: GameView;
  blocked: boolean;
  act: (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;
}) {
  const { t } = useI18n();
  const speech = game.speech;
  const me = room.players.find(player => player.id === room.meId);
  const [elapsed, setElapsed] = useState(0);
  const speaker = speech && speech.index < speech.order.length ? speech.order[speech.index] : null;
  const mySpeech = !!me && speaker === me.seat;

  // Count from the server's clock so every phone shows the same time.
  useEffect(() => {
    if (!speech || speaker === null) return;
    const receivedAt = Date.now();
    const base = speech.now - speech.startedAt;
    let buzzed = false;
    const tick = () => {
      const value = base + Date.now() - receivedAt;
      setElapsed(value);
      if (mySpeech && speech.seconds && !buzzed && value >= speech.seconds * 1000) {
        buzzed = true;
        try { navigator.vibrate?.([120, 80, 120]); } catch { /* Unsupported. */ }
      }
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [speech, speaker, mySpeech]);

  if (!speech || !me) return null;
  const chair = me.seat === game.leaderSeat || me.id === room.hostId;
  const name = (seat: number) => room.players.find(player => player.seat === seat)?.name ?? "";
  const remaining = speech.seconds * 1000 - elapsed;
  const over = speech.seconds > 0 && remaining < 0;
  const step = (input: Record<string, unknown>) => void act("speech", { turnId: game.turnId, ...input });

  return (
    <div className={`speech-bar${mySpeech ? " mine" : ""}`} aria-label={t("发言顺序")} role="group">
      <div className="speech-head">
        <span className="speech-title"><Mic size={15} aria-hidden="true" />{t("发言顺序")}</span>
        {speaker !== null && <span className={`speech-clock${over ? " over" : ""}`} aria-label={over ? t("已超时") : t("发言计时")}>
          <Timer size={13} aria-hidden="true" />{speech.seconds ? (over ? `+${clock(remaining)}` : clock(remaining)) : clock(elapsed)}
        </span>}
      </div>
      <ol className="speech-order">
        {speech.order.map((seat, index) => (
          <li key={seat} className={index < speech.index ? "done" : index === speech.index ? "current" : ""} aria-current={index === speech.index ? "step" : undefined}>
            {seat}
          </li>
        ))}
      </ol>
      <p className="speech-now" role="status">
        {speaker === null ? t("全员发言结束，队长可以改车或发起表决。")
          : mySpeech ? t("轮到你发言。说完后点「我说完了」。")
          : t("正在发言：{n} 号 · {name}", { n: speaker, name: name(speaker) })}
      </p>
      <div className="speech-actions">
        {mySpeech && <button type="button" className="secondary-button speech-done" disabled={blocked} onClick={() => step({ step: "next", index: speech.index })}><SkipForward size={15} aria-hidden="true" />{t("我说完了")}</button>}
        {!mySpeech && chair && speaker !== null && <button type="button" className="text-button" disabled={blocked} onClick={() => step({ step: "next", index: speech.index })}><SkipForward size={15} aria-hidden="true" />{t("下一位")}</button>}
        {chair && speech.index > 0 && <button type="button" className="text-button" disabled={blocked} onClick={() => step({ step: "restart" })}><RotateCcw size={14} aria-hidden="true" />{t("再轮一遍")}</button>}
        {chair && <label className="speech-timer-select"><span>{t("计时")}</span>
          <select value={speech.seconds} disabled={blocked} onChange={event => step({ step: "timer", seconds: Number(event.target.value) })}>
            {TIMER_CHOICES.map(value => <option key={value} value={value}>{value ? t("{n} 秒", { n: value }) : t("不计时")}</option>)}
          </select>
        </label>}
      </div>
    </div>
  );
}
