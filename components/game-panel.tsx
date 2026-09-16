"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, CircleDashed, Crown, Flag, History, LockKeyhole, RotateCcw, Shield, Swords, ThumbsDown, ThumbsUp, Trophy, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ROLES, type RoomView } from "@/lib/game";

type Props = {
  room: RoomView;
  busy: boolean;
  connected: boolean;
  error: string;
  act: (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;
  onNewGame: () => void;
};
type Pending = { action: string; input: Record<string, unknown>; title: string; description: string; label: string };

const reasonCopy = {
  "three-failures": "三次任务失败，邪恶阵营获胜。",
  "five-rejections": "连续五次组队未获通过，邪恶阵营获胜。",
  "merlin-assassinated": "刺客找到了梅林，邪恶阵营获胜。",
  "assassin-missed": "刺客未能找到梅林，正义阵营守住了胜利。",
};

export function GamePanel({ room, busy, connected, error, act, onNewGame }: Props) {
  const [selection, setSelection] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [ballotOpen, setBallotOpen] = useState(false);
  const [card, setCard] = useState<"success" | "fail" | null>(null);
  const blocked = busy || !connected;
  const feedback = !connected ? "连接暂时中断，恢复后可以继续提交。" : error;
  const me = room.players.find(player => player.id === room.meId);
  const game = room.game;

  // A task ballot is private: backgrounding the page closes and clears its draft.
  useEffect(() => {
    const hide = () => { setBallotOpen(false); setCard(null); };
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

  const playerName = (seat: number) => room.players.find(player => player.seat === seat)?.name ?? "玩家";
  const seatsLabel = (seats: number[]) => seats.map(seat => `${seat} 号`).join("、");

  if (!game) {
    if (room.phase !== "ready" || !me) return null;
    return <section className="game-panel game-start">
      <div className="game-start-icon"><Crown size={28} aria-hidden="true" /></div>
      <div><span className="game-kicker">READY AT THE TABLE</span><h2>全员就绪，可以出发了。</h2><p>首任队长是 <strong>{room.firstLeader} 号 · {playerName(room.firstLeader ?? 1)}</strong>。面对面讨论后，由队长提议第一支队伍。</p></div>
      {me.id === room.hostId
        ? <button className="primary-button" disabled={blocked} onClick={() => void act("begin")}>开始对局<ArrowRight size={18} /></button>
        : <p className="waiting-note" role="status">等待房主开始对局</p>}
    </section>;
  }

  const leader = me?.seat === game.leaderSeat;
  const onTeam = !!me && game.team.includes(me.seat);
  const goodWins = game.quests.filter(quest => quest.success).length;
  const evilWins = game.quests.filter(quest => !quest.success).length;
  const lastProposal = game.proposals.at(-1);
  const stage = room.phase === "team" ? { label: "组建队伍", Icon: Users }
    : room.phase === "vote" ? { label: "全员表决", Icon: ThumbsUp }
    : room.phase === "quest" ? { label: "秘密任务", Icon: LockKeyhole }
    : room.phase === "assassination" ? { label: "最后刺杀", Icon: Swords }
    : { label: "本局结束", Icon: Trophy };
  const toggleSeat = (seat: number) => setSelection(current => current.includes(seat)
    ? current.filter(value => value !== seat)
    : current.length < game.teamSize ? [...current, seat].sort((a, b) => a - b) : current);

  async function confirmPending() {
    if (!pending) return;
    const result = await act(pending.action, pending.input);
    if (result) setPending(null);
  }

  return <section className={`game-panel phase-${room.phase}`} aria-label="当前对局">
    <div className="game-topline">
      <div className="game-workspace-title"><span className="game-kicker">THE ROUND TABLE</span><strong>圆桌议事 <span>第 {room.round} 局</span></strong></div>
      <span className={`game-phase-chip ${room.phase === "assassination" ? "danger" : ""}`}><stage.Icon size={15} aria-hidden="true" />{stage.label}</span>
    </div>
    <div className="game-score" aria-label={`任务比分：正义 ${goodWins}，邪恶 ${evilWins}`}>
      <div className="game-score-side good"><Shield size={19} aria-hidden="true" /><span>正义任务</span><div className="score-dots" aria-hidden="true">{[1, 2, 3].map(point => <i key={point} className={point <= goodWins ? "filled" : ""} />)}</div><strong>{goodWins}<small>/ 3</small></strong></div>
      <div className="game-score-side evil"><Swords size={19} aria-hidden="true" /><span>邪恶任务</span><div className="score-dots" aria-hidden="true">{[1, 2, 3].map(point => <i key={point} className={point <= evilWins ? "filled" : ""} />)}</div><strong>{evilWins}<small>/ 3</small></strong></div>
    </div>
    <ol className="quest-track" aria-label="五次任务进度">
      {[1, 2, 3, 4, 5].map(number => {
        const quest = game.quests.find(item => item.quest === number);
        const current = !quest && game.quest === number && room.phase !== "finished" && room.phase !== "assassination";
        return <li key={number} className={`${quest ? quest.success ? "success" : "failure" : ""} ${current ? "current" : ""}`} aria-current={current ? "step" : undefined}>
          <span className="quest-step-label">任务 {number}</span>
          <span className="quest-step-symbol" aria-hidden="true">{quest ? quest.success ? <Check size={19} /> : <X size={19} /> : current ? <Flag size={18} /> : <CircleDashed size={19} />}</span>
          <strong>{quest ? quest.success ? "成功" : "失败" : current ? "当前" : "待开始"}</strong>
          {quest && <small>{quest.failCount} 张失败</small>}
        </li>;
      })}
    </ol>
    <p className="quest-rule-note">{room.capacity >= 7 ? "第 4 次任务需要 2 张失败牌才会失败，其余任务 1 张即失败。" : "任务中出现 1 张失败牌，该次任务即失败。"}</p>

    {room.phase !== "finished" && room.phase !== "assassination" && <div className="quest-context">
      <span className="quest-leader"><Crown size={17} aria-hidden="true" /><span>当前队长 <b>{game.leaderSeat} 号 · {playerName(game.leaderSeat)}</b></span></span>
      <span><Users size={16} aria-hidden="true" />任务队伍 <b>{game.teamSize} 人</b></span>
      <span className={game.rejections === 4 ? "danger-copy" : ""}><Flag size={15} aria-hidden="true" />连续否决 <b>{game.rejections} / 5</b></span>
    </div>}

    {room.phase === "team" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><Users size={25} aria-hidden="true" /></span><div><span className="action-kicker">{leader ? "轮到你了" : "现在可以线下讨论"}</span><h2>{leader ? "选出你的任务队伍" : "等待队长提议队伍"}</h2><p>{game.rejections === 4 ? "这是最后一次组队机会。再次否决，邪恶阵营将直接获胜。" : `面对面讨论后，由队长选出 ${game.teamSize} 位执行任务的玩家。`}</p></div></div>
      {leader ? <>
        <div className="team-selector" aria-label="选择任务队员">{room.players.map(player => <button key={player.id} className={`player-option ${selection.includes(player.seat) ? "selected" : ""}`} aria-pressed={selection.includes(player.seat)} disabled={blocked || (!selection.includes(player.seat) && selection.length === game.teamSize)} onClick={() => toggleSeat(player.seat)}>
          <span className="player-number">{player.seat}</span><span>{player.name}{player.id === me?.id && <small>我</small>}</span><span className="selection-check">{selection.includes(player.seat) && <Check size={15} />}</span>
        </button>)}</div>
        <div className="game-action-footer"><p><strong>已选 {selection.length} / {game.teamSize} 人</strong><span>可以不选自己</span></p><button className="primary-button" disabled={blocked || selection.length !== game.teamSize} onClick={() => setPending({ action: "propose", input: { turnId: game.turnId, team: selection }, title: "提交这支队伍？", description: `队员：${seatsLabel(selection)}。提交后由全员表决，本次队伍不能再更改。`, label: "提交队伍" })}>提交队伍<ArrowRight size={17} /></button></div>
      </> : <p className="waiting-note" role="status">{me ? "现在可以线下讨论，队长提交后所有人将同时投票。" : "你正在查看房间的公开对局状态。"}</p>}
    </div>}

    {(room.phase === "vote" || room.phase === "quest") && <div className="proposed-team"><span>{room.phase === "vote" ? "提议队伍" : "执行任务"}</span><div>{game.team.map(seat => <span className="team-member" key={seat}><b>{seat}</b>{playerName(seat)}</span>)}</div></div>}

    {room.phase === "vote" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><ThumbsUp size={24} aria-hidden="true" /></span><div><span className="action-kicker">{game.myTeamVote === null ? "每个人都有一票" : "你的表决已锁定"}</span><h2>这支队伍，值得信任吗？</h2><p>全员提交后统一公开结果。需 {Math.floor(room.capacity / 2) + 1} 人赞成，平票不通过。</p></div></div>
      <div className="voter-progress" aria-label={`已有 ${game.votedSeats.length} 人表决`}>{room.players.map(player => <span key={player.id} title={`${player.seat} 号 · ${player.name}${game.votedSeats.includes(player.seat) ? "：已提交" : "：等待表决"}`} className={game.votedSeats.includes(player.seat) ? "submitted" : ""}>{player.seat}{game.votedSeats.includes(player.seat) && <Check size={12} aria-hidden="true" />}</span>)}</div>
      <p className="action-note" role="status">已提交 {game.votedSeats.length} / {room.capacity} 票 · 提交后不能改票</p>
      {me && game.myTeamVote === null ? <div className="vote-actions">
        {[true, false].map(approve => <button key={String(approve)} className={`ballot-choice ${approve ? "approve" : "reject"}`} disabled={blocked} onClick={() => setPending({ action: "vote", input: { turnId: game.turnId, approve }, title: `确认${approve ? "赞成" : "反对"}这支队伍？`, description: `队员：${seatsLabel(game.team)}。全员提交后，你的投票会公开记入本局记录，提交后不能更改。`, label: `确认${approve ? "赞成" : "反对"}` })}>{approve ? <ThumbsUp size={23} /> : <ThumbsDown size={23} />}<strong>{approve ? "赞成" : "反对"}</strong></button>)}
      </div> : <p className="waiting-note" role="status">{me ? "你的表决已锁定，等待全员揭晓。" : "等待房间成员完成表决。"}</p>}
    </div>}

    {room.phase === "quest" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><LockKeyhole size={24} aria-hidden="true" /></span><div><span className="action-kicker">仅任务队员参与</span><h2>秘密投下你的任务牌</h2><p>{game.failsRequired === 2 ? "本任务至少出现 2 张失败牌才会失败。" : "只要出现 1 张失败牌，本任务就会失败。"}个人任务票始终保密。</p></div></div>
      <div className="sealed-progress"><LockKeyhole size={28} strokeWidth={1.4} aria-hidden="true" /><p className="ballot-count" role="status"><b>{game.submittedQuestCount}</b> / {game.teamSize}<span>任务票已密封</span></p></div>
      {onTeam && game.myQuestVote === null ? <button className="primary-button" disabled={blocked} onClick={() => { setCard(null); setBallotOpen(true); }}><LockKeyhole size={18} />私密提交任务票</button>
        : <p className="waiting-note" role="status">{onTeam ? "你的任务票已密封，等待其他队员。" : "本次无需你投任务票，等待队员完成。"}</p>}
      <p className="action-note">只公布失败牌总数，不显示谁投了哪张牌。</p>
    </div>}

    {room.phase === "assassination" && <div className="game-action assassination">
      <div className="game-action-heading"><span className="step-icon"><Swords size={27} aria-hidden="true" /></span><div><span className="action-kicker">最后一次机会</span><h2>找到梅林，逆转结局。</h2><p>三次任务成功。邪恶阵营可以公开讨论，由刺客做出最终选择。</p></div></div>
      {room.identity?.role === "assassin" ? <>
        <p className="muted-copy">选择你怀疑的梅林。确认后立即结算，不能更改。</p>
        <div className="team-selector">{room.players.filter(player => player.id !== me?.id).map(player => <button key={player.id} className={`player-option ${target === player.seat ? "selected" : ""}`} aria-pressed={target === player.seat} disabled={blocked} onClick={() => setTarget(player.seat)}><span className="player-number">{player.seat}</span><span>{player.name}</span><span className="selection-check">{target === player.seat && <Check size={15} />}</span></button>)}</div>
        <button className="primary-button assassination-button" disabled={blocked || target === null} onClick={() => setPending({ action: "assassinate", input: { turnId: game.turnId, targetSeat: target }, title: `刺杀 ${target} 号 · ${playerName(target!)}？`, description: "这是一局中唯一的刺杀机会。确认后立即揭晓结局，无法撤销或重新选择。", label: "确认刺杀" })}><Swords size={18} />确认刺杀目标</button>
      </> : <p className="waiting-note" role="status">等待刺客选择目标。请继续保护梅林的身份。</p>}
    </div>}

    {room.phase === "finished" && game.result && <div className={`game-result ${game.result.winner}`}>
      <span className="result-emblem"><Trophy size={38} strokeWidth={1.3} aria-hidden="true" /></span><span className="game-kicker">THE STORY IS TOLD</span><h2>{game.result.winner === "good" ? "正义守住了圆桌。" : "暗影笼罩了圆桌。"}</h2><p>{reasonCopy[game.result.reason]}</p>
      {game.result.targetSeat != null && <p className="assassination-result">刺杀目标：{game.result.targetSeat} 号 · {playerName(game.result.targetSeat)}</p>}
      {game.revealedRoles && <div className="result-identity-list"><h3>此刻，身份揭晓。</h3><div className="revealed-roles">{game.revealedRoles.map(player => <div key={player.seat}><span className="member-seat">{player.seat}</span><span>{playerName(player.seat)}</span><strong className={ROLES[player.role].side}>{ROLES[player.role].name}</strong></div>)}</div></div>}
      {!me && <p className="action-note">完整身份仅向本局成员揭晓。</p>}
      <div className="rematch-actions">{me?.id === room.hostId ? <button className="primary-button" disabled={blocked} onClick={() => setPending({ action: "rematch", input: { round: room.round }, title: "同房再来一局？", description: "保留房间码、玩家和座位，清除本局身份与全部投票记录。请先完成复盘；重开后所有人重新准备、重新发身份。房间仍在创建 24 小时后过期。", label: "确认重开" })}><RotateCcw size={17} />同房再来一局</button> : me && <p className="waiting-note" role="status">复盘完成后，可以请房主开启同房新一局。</p>}
      <button className="secondary-button" onClick={onNewGame}>返回首页<ArrowRight size={16} /></button></div>
      <p className="action-note">本局记录保留到同房重开或房间过期。重开前，请先完成复盘。</p>
    </div>}

    {lastProposal && !lastProposal.approved && room.phase === "team" && <div className="last-proposal"><Flag size={17} /><span>上一支队伍未通过：{lastProposal.votes.filter(vote => vote.approve).length} 赞成 / {lastProposal.votes.filter(vote => !vote.approve).length} 反对。已轮到下一位队长。</span></div>}

    <details className="game-history" open={room.phase === "finished" ? true : undefined}>
      <summary><span className="history-title"><History size={18} aria-hidden="true" /><span>对局记录</span></span><small>{game.proposals.length} 次表决 · {game.quests.length} 次任务</small><ChevronDown className="history-chevron" size={17} aria-hidden="true" /></summary>
      {!game.proposals.length ? <p className="history-empty">完成第一次组队表决后，记录会显示在这里。</p> : <><p className="history-hint"><ArrowLeftRight size={15} aria-hidden="true" />左右滑动，查看每位玩家的表决。</p><div className="history-scroll" tabIndex={0} role="region" aria-label="组队投票历史，可左右滚动"><table><caption className="sr-only">每次组队的队长、队员及逐人表决结果</caption><thead><tr><th>任务 / 提议</th><th>队长</th><th>队员</th>{room.players.map(player => <th key={player.id} title={player.name}>{player.seat} 号</th>)}<th>结果</th></tr></thead><tbody>{game.proposals.map(proposal => <tr key={proposal.id}><th>{proposal.quest} / {proposal.attempt}</th><td>{proposal.leaderSeat} 号</td><td>{proposal.team.join("、")}</td>{room.players.map(player => {
        const vote = proposal.votes.find(item => item.seat === player.seat);
        return <td key={player.id} className={vote?.approve ? "vote-yes" : "vote-no"} aria-label={`${player.seat} 号${vote?.approve ? "赞成" : "反对"}`}>{vote?.approve ? "赞成" : "反对"}</td>;
      })}<td><span className={`history-result ${proposal.approved ? "passed" : "rejected"}`}>{proposal.approved ? "通过" : "否决"}</span></td></tr>)}</tbody></table></div></>}
      {game.quests.length > 0 && <div className="quest-history">{game.quests.map(quest => <div key={quest.quest}><span>任务 {quest.quest}</span><span>{seatsLabel(quest.team)}</span><strong className={quest.success ? "vote-yes" : "vote-no"}>{quest.success ? "成功" : "失败"} · {quest.failCount} 张失败</strong></div>)}</div>}
      <p className="action-note">组队表决公开记录；任务牌仅记录总数，结束后也不会公开个人任务票。</p>
    </details>

    <AlertDialog open={!!pending} onOpenChange={open => { if (!open && !busy) setPending(null); }}>
      <AlertDialogContent className="game-confirm-dialog"><AlertDialogTitle>{pending?.title}</AlertDialogTitle><AlertDialogDescription>{pending?.description}</AlertDialogDescription>{feedback && <p className="ballot-error" role="alert">{feedback}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>再想一下</AlertDialogCancel><AlertDialogAction disabled={blocked} onClick={event => { event.preventDefault(); void confirmPending(); }}>{busy ? "正在提交…" : pending?.label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <Dialog open={ballotOpen && room.phase === "quest"} onOpenChange={open => { setBallotOpen(open); if (!open) setCard(null); }}>
      <DialogContent className="private-ballot-dialog"><span className="private-ballot-label"><LockKeyhole size={15} aria-hidden="true" />仅你可见</span><DialogTitle>你的秘密任务票</DialogTitle><DialogDescription>先确认周围没有人在看屏幕。选好后点击提交，无法改票。</DialogDescription>
        <div className="vote-actions">{(["success", "fail"] as const).map(value => <button key={value} className={`ballot-choice ${value === "success" ? "approve" : "reject"} ${card === value ? "selected" : ""}`} aria-pressed={card === value} disabled={blocked || (value === "fail" && room.identity?.side !== "evil")} onClick={() => setCard(value)}>{value === "success" ? <Shield size={24} /> : <Swords size={24} />}<strong>{value === "success" ? "成功" : "失败"}</strong>{card === value && <Check size={17} />}</button>)}</div>
        <p className="action-note">{room.identity?.side === "evil" ? "你可以选择成功或失败。" : "正义阵营只能提交成功牌。"}任务票不会关联到你的座位公开。</p>
        {feedback && <p className="ballot-error" role="alert">{feedback}</p>}
        <button className="primary-button" disabled={blocked || card === null} onClick={async () => { const result = await act("quest", { turnId: game.turnId, card }); if (result) { setBallotOpen(false); setCard(null); } }}>{busy ? "正在密封…" : card ? `密封提交「${card === "success" ? "成功" : "失败"}」` : "请先选择任务牌"}<LockKeyhole size={17} /></button>
      </DialogContent>
    </Dialog>
  </section>;
}
