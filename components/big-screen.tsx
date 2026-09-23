"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleDashed, Crown, Flag, LockKeyhole, Shield, Swords, ThumbsUp, Trophy, Users, Waves, X } from "lucide-react";
import { PRESETS, type RoomView } from "@/lib/game";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";
import { useRoomLive } from "@/lib/use-room-live";
import { GameTable } from "@/components/game-table";
import { SpeechBar } from "@/components/speech-bar";
import { VoteMatrix } from "@/components/vote-matrix";
import { RevealOverlay } from "@/components/reveal-overlay";
import { ThemeToggle } from "@/components/theme-toggle";

const REASONS = {
  "three-failures": msg("三次任务失败，邪恶阵营获胜。"),
  "five-rejections": msg("连续五次组队未获通过，邪恶阵营获胜。"),
  "merlin-assassinated": msg("刺客找到了梅林，邪恶阵营获胜。"),
  "assassin-missed": msg("刺客未能找到梅林，正义阵营守住了胜利。"),
};
const INVITE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const noop = async () => null;

/**
 * Big-screen mode (v1.10): a tablet or laptop in the middle of the table shows
 * only what everyone may see — the round table, quests, who speaks, the vote
 * reveal and the vote record. It never shows anyone's role, lake results or
 * who played which card (the server sends the public view only), and it has
 * no buttons: players still act on their own phones.
 */
export function BigScreen() {
  const { t } = useI18n();
  const [target, setTarget] = useState<{ code: string; invite: string | null } | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [problem, setProblem] = useState("");

  // Read the room and invite from the link once, then keep them out of the address bar.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("room") ?? "";
    const invite = params.get("invite");
    const next = /^\d{6}$/.test(code) ? { code, invite: invite && INVITE_PATTERN.test(invite) ? invite : null } : null;
    if (params.has("invite")) history.replaceState(null, "", `/screen?room=${code}`);
    const timer = setTimeout(() => { setTarget(next); if (!next) setProblem(msg("链接中缺少房间码。")); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    if (!target) return;
    try {
      const response = await fetch(`/api/room?code=${target.code}&view=screen`, { cache: "no-store", headers: target.invite ? { "X-Avalon-Invite": target.invite } : {} });
      const data = await response.json();
      if (!response.ok) { setProblem((data as { error?: string }).error || msg("操作未完成，请重试。")); return; }
      setRoom(data as RoomView); setProblem("");
    } catch { setProblem(msg("连接暂时中断，正在重试。")); }
  }, [target]);
  const live = useRoomLive(target?.code ?? null, useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!target) return;
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), live ? 30000 : 3000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [target, load, live]);

  if (!room) return <main className="big-screen empty"><p role="status">{problem ? t(problem) : t("正在连接房间…")}</p></main>;
  // Even on a seated player's device, the screen behaves like nobody's device.
  const table: RoomView = { ...room, meId: null, identity: null };
  const game = table.game;
  const goodWins = game?.quests.filter(quest => quest.success).length ?? 0;
  const evilWins = (game?.quests.length ?? 0) - goodWins;
  const name = (seat: number) => table.players.find(player => player.seat === seat)?.name || t("{n} 号", { n: seat });

  return (
    <main className="big-screen">
      <header className="big-screen-head">
        <span className="brand-icon"><Crown size={22} aria-hidden="true" /></span>
        <h1 className="big-screen-title">{t("圆桌 · 大屏")}</h1>
        <span>{t("{n} 人", { n: table.capacity })} · {t(PRESETS[table.preset].name)} · {t("第 {n} 局", { n: table.round })}</span>
        <span className="big-screen-code">{t("房间码")} <b>{table.code}</b></span>
        <ThemeToggle />
        <span className={`room-section-status${live ? " live" : ""}`} role="img" aria-label={live ? t("实时") : t("已同步")}><i aria-hidden="true" /></span>
      </header>
      {!game ? (
        <section className="big-screen-waiting">
          <h2>{table.phase === "lobby" ? t("等待朋友入座") : t("等待房主开始对局")}</h2>
          <p>{t("入座 {n} / {total}", { n: table.players.length, total: table.capacity })}</p>
          {!room.namesHidden ? null : <p className="action-note">{t("请用房间里的「大屏模式」链接打开，才能显示对局。")}</p>}
        </section>
      ) : (
        <div className="big-screen-grid">
          <section className="big-screen-table">
            <GameTable room={table} game={game} marks={{}} />
          </section>
          <section className="big-screen-info">
            <div className="big-screen-score" aria-label={t("任务比分：正义 {good}，邪恶 {evil}", { good: goodWins, evil: evilWins })}>
              <span className="good"><Shield size={22} aria-hidden="true" />{t("正义")} <b>{goodWins}</b></span>
              <span className="evil"><Swords size={22} aria-hidden="true" />{t("邪恶")} <b>{evilWins}</b></span>
            </div>
            <ol className="quest-track big-screen-quests" aria-label={t("五次任务进度")}>
              {[1, 2, 3, 4, 5].map(number => {
                const quest = game.quests.find(item => item.quest === number);
                const current = !quest && game.quest === number && table.phase !== "finished" && table.phase !== "assassination";
                return <li key={number} className={`${quest ? quest.success ? "success" : "failure" : ""} ${current ? "current" : ""}`}>
                  <span className="quest-step-label">{t("任务 {n}", { n: number })}</span>
                  <span className="quest-step-symbol" aria-hidden="true">{quest ? quest.success ? <Check size={22} /> : <X size={22} /> : current ? <Flag size={20} /> : <CircleDashed size={20} />}</span>
                  <strong>{quest ? quest.success ? t("成功") : t("失败") : current ? t("当前") : t("待开始")}</strong>
                </li>;
              })}
            </ol>
            <div className="big-screen-phase" role="status">
              {table.phase === "team" && <><Users size={26} aria-hidden="true" /><div><strong>{t("组建队伍")}</strong><span>{t("队长 {n} 号 · {name} · 需要 {size} 人 · 第 {a} 车", { n: game.leaderSeat, name: name(game.leaderSeat), size: game.teamSize, a: game.rejections + 1 })}</span>{game.draftTeam.length > 0 && <span className="big-screen-team">{t("队长亮车")}{t("：")}{game.draftTeam.map(seat => <b key={seat}>{seat}</b>)}</span>}</div></>}
              {table.phase === "vote" && <><ThumbsUp size={26} aria-hidden="true" /><div><strong>{t("全员表决")}</strong><span>{t("已提交 {n} / {total} 票", { n: game.votedSeats.length, total: table.capacity })}</span><span className="big-screen-team">{t("提议队伍")}{t("：")}{game.team.map(seat => <b key={seat}>{seat}</b>)}</span></div></>}
              {table.phase === "quest" && <><LockKeyhole size={26} aria-hidden="true" /><div><strong>{t("秘密任务")}</strong><span>{t("任务票已密封 {n} / {total}", { n: game.submittedQuestCount, total: game.teamSize })}</span><span className="big-screen-team">{t("执行任务")}{t("：")}{game.team.map(seat => <b key={seat}>{seat}</b>)}</span></div></>}
              {table.phase === "lake" && game.lake && <><Waves size={26} aria-hidden="true" /><div><strong>{t("湖中仙女")}</strong><span>{t("{n} 号 · {name} 正在私密查验", { n: game.lake.holderSeat, name: name(game.lake.holderSeat) })}</span></div></>}
              {table.phase === "assassination" && <><Swords size={26} aria-hidden="true" /><div><strong>{t("最后刺杀")}</strong><span>{t("等待刺客选择目标。")}</span></div></>}
              {table.phase === "finished" && game.result && <><Trophy size={26} aria-hidden="true" /><div><strong className={game.result.winner === "good" ? "vote-yes" : "vote-no"}>{game.result.winner === "good" ? t("正义获胜") : t("邪恶获胜")}</strong><span>{t(REASONS[game.result.reason])}</span><span>{t("身份和出牌只在各自的手机上揭晓。")}</span></div></>}
            </div>
            {table.phase === "team" && <SpeechBar room={table} game={game} blocked act={noop} />}
            {game.proposals.length > 0 && <div className="game-history big-screen-log"><VoteMatrix room={table} game={game} /></div>}
          </section>
        </div>
      )}
      <RevealOverlay key={table.round} room={table} />
    </main>
  );
}
