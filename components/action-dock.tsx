"use client";

import { useEffect, useState } from "react";
import { Check, LockKeyhole, Shield, Swords, ThumbsDown, ThumbsUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

type Act = (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;

/** Team votes and quest cards, pinned to the bottom on every room tab. */
export function ActionDock({ room, busy, connected, error, act }: { room: RoomView; busy: boolean; connected: boolean; error: string; act: Act }) {
  const { t, ts } = useI18n();
  const game = room.game;
  const me = room.players.find(player => player.id === room.meId);
  const needVote = !!game && !!me && room.phase === "vote" && game.myTeamVote === null;
  const needQuest = !!game && !!me && room.phase === "quest" && game.team.includes(me.seat) && game.myQuestVote === null;
  const [card, setCard] = useState<"success" | "fail" | null>(null);
  const [approve, setApprove] = useState<boolean | null>(null);
  const blocked = busy || !connected;

  useEffect(() => {
    const hide = () => setCard(null);
    const visibility = () => { if (document.hidden) hide(); };
    window.addEventListener("blur", hide);
    window.addEventListener("pagehide", hide);
    window.addEventListener("offline", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("offline", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  if (!game || (!needVote && !needQuest)) return null;
  const seats = game.team.map(seat => t("{n} 号", { n: seat })).join(t("、"));
  const feedback = !connected ? t("连接暂时中断，恢复后可以继续提交。") : ts(error);

  return <aside className="action-dock" aria-label={needVote ? t("全员表决") : t("你的秘密任务票")}>
    {needVote ? <>
      <p className="action-dock-title">{t("这支队伍，值得信任吗？")}</p>
      <p className="action-dock-note">{t("队员：{seats}。提交后不能更改。", { seats })}</p>
      <div className="vote-actions">
        {[true, false].map(choice => <button key={String(choice)} type="button" className={`ballot-choice ${choice ? "approve" : "reject"}`} disabled={blocked} onClick={() => setApprove(choice)}>{choice ? <ThumbsUp size={23} /> : <ThumbsDown size={23} />}<strong>{choice ? t("赞成") : t("反对")}</strong></button>)}
      </div>
      <AlertDialog open={approve !== null} onOpenChange={open => { if (!open && !busy) setApprove(null); }}>
        <AlertDialogContent className="game-confirm-dialog">
          <AlertDialogTitle>{approve ? t("确认赞成这支队伍？") : t("确认反对这支队伍？")}</AlertDialogTitle>
          <AlertDialogDescription>{t("队员：{seats}。全员提交后，你的投票会公开记入本局记录，提交后不能更改。", { seats })}</AlertDialogDescription>
          {feedback && <p className="ballot-error" role="alert">{feedback}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("再想一下")}</AlertDialogCancel>
            <AlertDialogAction disabled={blocked} onClick={event => { event.preventDefault(); void act("vote", { turnId: game.turnId, approve: approve === true }).then(result => { if (result) setApprove(null); }); }}>{busy ? t("正在提交…") : approve ? t("确认赞成") : t("确认反对")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </> : <>
      <p className="action-dock-title"><LockKeyhole size={16} aria-hidden="true" />{t("仅你可见")} · {t("你的秘密任务票")}</p>
      <p className="action-dock-note">{t("先确认周围没有人在看屏幕。选好后点击提交，无法改票。")} {game.allowedQuestCards.length === 2 ? t("你可以选择成功或失败。任务票不会关联到你的座位公开。") : game.allowedQuestCards[0] === "fail" ? t("疯子参加任务时必须提交失败牌。任务票不会关联到你的座位公开。") : room.identity?.role === "brute" ? t("野蛮人在第四、第五次任务只能提交成功牌。任务票不会关联到你的座位公开。") : t("正义阵营只能提交成功牌。任务票不会关联到你的座位公开。")}</p>
      <div className="vote-actions">{(["success", "fail"] as const).map(value => <button key={value} type="button" className={`ballot-choice ${value === "success" ? "approve" : "reject"} ${card === value ? "selected" : ""}`} aria-pressed={card === value} disabled={blocked || !game.allowedQuestCards.includes(value)} onClick={() => setCard(value)}>{value === "success" ? <Shield size={24} /> : <Swords size={24} />}<strong>{value === "success" ? t("成功") : t("失败")}</strong>{card === value && <Check size={17} />}</button>)}</div>
      {feedback && <p className="ballot-error" role="alert">{feedback}</p>}
      <button type="button" className="primary-button" disabled={blocked || card === null} onClick={() => { void act("quest", { turnId: game.turnId, card }).then(result => { if (result) setCard(null); }); }}>{busy ? t("正在密封…") : card === "success" ? t("密封提交「成功」") : card === "fail" ? t("密封提交「失败」") : t("请先选择任务牌")}<LockKeyhole size={17} /></button>
    </>}
  </aside>;
}
