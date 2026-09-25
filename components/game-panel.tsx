"use client";

import { useEffect, useState } from "react";
import { Eye, ArrowRight, Check, ChevronDown, CircleDashed, Crown, Flag, History, LockKeyhole, RotateCcw, Shield, Swords, ThumbsUp, Trophy, Users, Waves, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ROLES, type GameView, type Role, type RoomView } from "@/lib/game";
import { ReplayExport } from "@/components/replay-export";
import { ReplayTimeline } from "@/components/replay-timeline";
import { EarlyAssassination } from "@/components/early-assassination";
import { gameHighlights } from "@/lib/highlights";
import { recordFromView, usePersonalRecord } from "@/lib/personal-record";
import { RoomRecord } from "@/components/room-record";
import { RoleInfoButton } from "@/components/role-info";
import { MarkTag } from "@/components/player-notes";
import { GameTable } from "@/components/game-table";
import { SpeechBar } from "@/components/speech-bar";
import { VoteMatrix } from "@/components/vote-matrix";
import { usePlayerNotes } from "@/lib/player-notes";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";

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
  "three-failures": msg("三次任务失败，邪恶阵营获胜。"),
  "five-rejections": msg("连续五次组队未获通过，邪恶阵营获胜。"),
  "merlin-assassinated": msg("刺客找到了梅林，邪恶阵营获胜。"),
  "assassin-missed": msg("刺客未能找到梅林，正义阵营守住了胜利。"),
};

function HighlightList({ game, playerName }: { game: GameView; playerName: (seat: number) => string }) {
  const { t } = useI18n();
  const lines = gameHighlights(game, game.revealedRoles, seat => t("{n} 号 · {name}", { n: seat, name: playerName(seat) }), t("、"));
  if (!lines.length) return null;
  return <div className="result-highlights"><h3>{t("本局高光")}</h3><ul>{lines.map((line, index) => <li key={index}>{t(line.key, line.vars)}</li>)}</ul></div>;
}

/** Who leads each remaining attempt of this quest. The third team skips the vote. */
function LeaderOrder({ room, game }: { room: RoomView; game: GameView }) {
  const { t } = useI18n();
  if (room.phase !== "team" && room.phase !== "vote") return null;
  const attempt = game.rejections + 1;
  const items = Array.from({ length: Math.max(0, 4 - attempt) }, (_, index) => ({ attempt: attempt + index, seat: (game.leaderSeat - 1 + index) % room.capacity + 1 }));
  return <div className={`leader-order${attempt === 3 ? " hammer-now" : ""}`}>
    {attempt === 3 && <p className="hammer-warning" role="status"><Flag size={16} aria-hidden="true" />{t("第三车：这支队伍不表决，直接执行任务。")}</p>}
    <ol aria-label={t("接下来的队长顺序")}>{items.map(item => <li key={item.attempt} className={`${item.attempt === attempt ? "current" : ""}${item.attempt === 3 ? " hammer" : ""}`}><small>{t("第 {a} 车", { a: item.attempt })}</small><b>{t("{n} 号", { n: item.seat })}</b></li>)}</ol>
  </div>;
}

export function GamePanel({ room, busy, connected, error, act, onNewGame }: Props) {
  const { t, ts } = useI18n();
  const { notes, setMark } = usePlayerNotes(room.code, room.round, room.roles);
  const { remember } = usePersonalRecord();
  const [selection, setSelection] = useState<number[]>(() => room.game?.draftTeam ?? []);
  const [target, setTarget] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const blocked = busy || !connected;
  const feedback = !connected ? t("连接暂时中断，恢复后可以继续提交。") : ts(error);
  const me = room.players.find(player => player.id === room.meId);
  const game = room.game;

  // One local row per finished game. Spectators have no revealed role, so they are skipped.
  useEffect(() => {
    const entry = room.game?.result ? recordFromView(room, Date.now()) : null;
    if (entry) remember(entry);
  }, [remember, room]);

  const playerName = (seat: number) => room.players.find(player => player.seat === seat)?.name ?? t("玩家");
  const seatsLabel = (seats: number[]) => seats.map(seat => t("{n} 号", { n: seat })).join(t("、"));
  // Lancelots end the game on whichever side the loyalty cards left them.
  const finalSide = (role: Role) => (role === "goodLancelot" || role === "evilLancelot") && game?.lancelotsSwitched ? (ROLES[role].side === "good" ? "evil" : "good") : ROLES[role].side;
  const seatName = (seat: number) => t("{n} 号 · {name}", { n: seat, name: playerName(seat) });

  if (!game) {
    if (room.phase !== "ready" || !me) return null;
    return <section className="game-panel game-start">
      <div className="game-start-icon"><Crown size={28} aria-hidden="true" /></div>
      <div><span className="game-kicker">READY AT THE TABLE</span><h2>{t("全员就绪，可以出发了。")}</h2><p>{t("首任队长是")} <strong>{t("{n} 号 · {name}", { n: room.firstLeader ?? "", name: playerName(room.firstLeader ?? 1) })}</strong>{t("。面对面讨论后，由队长提议第一支队伍。")}</p></div>
      {me.id === room.hostId
        ? <button className="primary-button" disabled={blocked} onClick={() => void act("begin")}>{t("开始对局")}<ArrowRight size={18} /></button>
        : <p className="waiting-note" role="status">{t("等待房主开始对局")}</p>}
    </section>;
  }

  const leader = me?.seat === game.leaderSeat;
  const onTeam = !!me && game.team.includes(me.seat);
  const goodWins = game.quests.filter(quest => quest.success).length;
  const evilWins = game.quests.filter(quest => !quest.success).length;
  const lastProposal = game.proposals.at(-1);
  const stage = room.phase === "team" ? { label: t("组建队伍"), Icon: Users }
    : room.phase === "vote" ? { label: t("全员表决"), Icon: ThumbsUp }
    : room.phase === "quest" ? { label: t("秘密任务"), Icon: LockKeyhole }
    : room.phase === "lake" ? { label: t("湖中仙女"), Icon: Waves }
    : room.phase === "assassination" ? { label: t("最后刺杀"), Icon: Swords }
    : { label: t("本局结束"), Icon: Trophy };
  const drafted = game.draftTeam.length > 0;
  const draftChanged = selection.length !== game.draftTeam.length || selection.some((seat, index) => seat !== game.draftTeam[index]);
  const toggleSeat = (seat: number) => setSelection(current => current.includes(seat)
    ? current.filter(value => value !== seat)
    : current.length < game.teamSize ? [...current, seat].sort((a, b) => a - b) : current);
  const latestLakeCheck = game.lake?.myChecks.at(-1);

  async function confirmPending() {
    if (!pending) return;
    const result = await act(pending.action, pending.input);
    if (result) setPending(null);
  }

  return <section id="room-game" className={`game-panel phase-${room.phase}`} aria-label={t("当前对局")}>
    <div className="game-topline">
      <div className="game-workspace-title"><span className="game-kicker">THE ROUND TABLE</span><strong>{t("圆桌议事")} <span>{t("第 {n} 局", { n: room.round })}</span></strong></div>
      {room.phase !== "team" && <div className="game-topline-actions"><span className={`game-phase-chip ${room.phase === "assassination" ? "danger" : ""}`}><stage.Icon size={15} aria-hidden="true" />{stage.label}</span></div>}
    </div>
    <div className="game-score" aria-label={t("任务比分：正义 {good}，邪恶 {evil}", { good: goodWins, evil: evilWins })}>
      <div className="game-score-side good"><Shield size={19} aria-hidden="true" /><span>{t("正义任务")}</span><div className="score-dots" aria-hidden="true">{[1, 2, 3].map(point => <i key={point} className={point <= goodWins ? "filled" : ""} />)}</div><strong>{goodWins}<small>/ 3</small></strong></div>
      <div className="game-score-side evil"><Swords size={19} aria-hidden="true" /><span>{t("邪恶任务")}</span><div className="score-dots" aria-hidden="true">{[1, 2, 3].map(point => <i key={point} className={point <= evilWins ? "filled" : ""} />)}</div><strong>{evilWins}<small>/ 3</small></strong></div>
    </div>
    <EarlyAssassination room={room} busy={busy} connected={connected} act={act} />
    {room.phase !== "finished" && <div className="game-table-wrap">
      <GameTable room={room} game={game} selection={selection} onToggle={room.phase === "team" && leader && !blocked ? toggleSeat : undefined} marks={notes.marks} onMark={room.meId && !blocked ? (seat, mark) => setMark(seat, mark) : undefined} />
      <LeaderOrder room={room} game={game} />
    </div>}
    <ol className="quest-track" aria-label={t("五次任务进度")}>
      {[1, 2, 3, 4, 5].map(number => {
        const quest = game.quests.find(item => item.quest === number);
        const current = !quest && game.quest === number && room.phase !== "finished" && room.phase !== "assassination";
        return <li key={number} className={`${quest ? quest.success ? "success" : "failure" : ""} ${current ? "current" : ""}`} aria-current={current ? "step" : undefined}>
          <span className="quest-step-label">{t("任务 {n}", { n: number })}</span>
          <span className="quest-step-symbol" aria-hidden="true">{quest ? quest.success ? <Check size={19} /> : <X size={19} /> : current ? <Flag size={18} /> : <CircleDashed size={19} />}</span>
          <strong>{quest ? quest.success ? t("成功") : t("失败") : current ? t("当前") : t("待开始")}</strong>
          {quest && <small>{t("{n} 张失败", { n: quest.failCount })}</small>}
        </li>;
      })}
    </ol>
    <p className="quest-rule-note">{room.capacity >= 7 ? t("第 4 次任务需要 2 张失败牌才会失败，其余任务 1 张即失败。") : t("任务中出现 1 张失败牌，该次任务即失败。")}</p>
    {game.loyalty && <div className="loyalty-track" role="group" aria-label={t("兰斯洛特忠诚牌")}>
      <span className="loyalty-title">{t("兰斯洛特忠诚牌")}</span>
      <span className="loyalty-cards">{game.loyalty.map((card, index) => <span key={index} className={`loyalty-card ${card}${game.quest >= index + 3 ? " active" : ""}`}>{t("第 {n} 轮", { n: index + 3 })} · {card === "switch" ? t("转换") : t("不变")}</span>)}</span>
      <small>{game.lancelotsSwitched ? t("两位兰斯洛特目前已互换阵营：原正义兰斯洛特只能出失败，原邪恶兰斯洛特只能出成功。") : t("两位兰斯洛特目前保持原阵营：正义兰斯洛特只能出成功，邪恶兰斯洛特只能出失败。")}</small>
    </div>}

    {room.phase !== "finished" && room.phase !== "assassination" && <div className="quest-context">
      <span className="quest-leader"><Crown size={17} aria-hidden="true" /><span>{t("当前队长")} <b>{seatName(game.leaderSeat)}</b></span></span>
      <span><Users size={16} aria-hidden="true" />{t("任务队伍")} <b>{t("{n} 人", { n: game.teamSize })}</b></span>
      <span className={game.rejections >= 2 ? "danger-copy" : ""}><Flag size={15} aria-hidden="true" />{t("连续否决")} <b>{game.rejections} / 2</b></span>
    </div>}

    {room.phase === "team" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><Users size={25} aria-hidden="true" /></span><div><span className="action-kicker">{leader ? t("轮到你了") : t("现在可以线下讨论")}</span><h2>{leader ? t("选出你的任务队伍") : t("等待队长提议队伍")}</h2><p>{game.rejections >= 2 ? t("这是第三车。发起后不表决，直接执行任务。") : t("面对面讨论后，由队长选出 {n} 位执行任务的玩家。", { n: game.teamSize })}</p></div></div>
      <SpeechBar room={room} game={game} blocked={blocked} act={act} />
      {leader ? <>
        <p className="table-pick-hint">{t("在上方圆桌上点选队员，再点一次取消。点头像右上角可以标记。")}</p>
        <p className="draft-status" role="status">{!drafted ? (room.turnSpeech ? t("先亮车给大家看，所有人发言后可以改车，再发起表决。") : t("先亮车给大家看，讨论完可以直接发起表决。")) : draftChanged ? t("改动还没亮给大家：点「改车」更新，或直接发起表决。") : (room.turnSpeech ? t("已亮车：{seats}。大家发言后可以改车或发起表决。", { seats: seatsLabel(game.draftTeam) }) : t("已亮车：{seats}。讨论完可以改车或发起表决。", { seats: seatsLabel(game.draftTeam) }))}</p>
        <div className="game-action-footer draft-footer">
          <p><strong>{t("已选 {n} / {size} 人", { n: selection.length, size: game.teamSize })}</strong><span>{t("可以不选自己")}</span></p>
          <div className="draft-buttons">
            <button type="button" className="secondary-button" disabled={blocked || selection.length === 0 || !draftChanged} onClick={() => void act("draft", { turnId: game.turnId, team: selection })}><Eye size={16} aria-hidden="true" />{drafted ? t("改车") : t("亮车")}</button>
            <button className="primary-button" disabled={blocked || selection.length !== game.teamSize} onClick={() => setPending({ action: "propose", input: { turnId: game.turnId, team: selection }, title: game.rejections >= 2 ? t("第三车直接出发？") : t("发起表决？"), description: game.rejections >= 2 ? t("队员：{seats}。这支队伍不表决，马上执行任务。", { seats: seatsLabel(selection) }) : t("队员：{seats}。发起后全员表决，这一车不能再改。", { seats: seatsLabel(selection) }), label: game.rejections >= 2 ? t("直接出发") : t("发起表决") })}>{game.rejections >= 2 ? t("直接出发") : t("发起表决")}<ArrowRight size={17} /></button>
          </div>
        </div>
        {drafted && <button type="button" className="text-button subtle draft-withdraw" disabled={blocked} onClick={() => { setSelection([]); void act("draft", { turnId: game.turnId, team: [] }); }}>{t("撤回亮车")}</button>}
      </> : me ? <div className="draft-view" role="status">{game.draftTeam.length ? <><span className="draft-label">{t("队长亮车")}</span><div>{game.draftTeam.map(seat => <span className="team-member" key={seat}><b>{seat}</b>{playerName(seat)}</span>)}</div><small>{room.turnSpeech ? t("发言后队长可能改车，发起表决后才开始投票。") : t("讨论完队长可能改车，发起表决后才开始投票。")}</small></> : <p className="waiting-note">{t("等待队长亮车。现在可以线下讨论。")}</p>}</div> : <p className="waiting-note" role="status">{t("你正在查看房间的公开对局状态。")}</p>}
    </div>}

    {(room.phase === "vote" || room.phase === "quest") && <div className="proposed-team"><span>{room.phase === "vote" ? t("提议队伍") : t("执行任务")}</span><div>{game.team.map(seat => <span className="team-member" key={seat}><b>{seat}</b>{playerName(seat)}</span>)}</div></div>}

    {room.phase === "vote" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><ThumbsUp size={24} aria-hidden="true" /></span><div><span className="action-kicker">{game.myTeamVote === null ? t("每个人都有一票") : t("你的表决已锁定")}</span><h2>{t("这支队伍，值得信任吗？")}</h2><p>{t("全员提交后统一公开结果。需 {n} 人赞成，平票不通过。", { n: Math.floor(room.capacity / 2) + 1 })}</p></div></div>
      <div className="voter-progress" aria-label={t("已有 {n} 人表决", { n: game.votedSeats.length })}>{room.players.map(player => <span key={player.id} title={game.votedSeats.includes(player.seat) ? t("{n} 号 · {name}：已提交", { n: player.seat, name: player.name }) : t("{n} 号 · {name}：等待表决", { n: player.seat, name: player.name })} className={game.votedSeats.includes(player.seat) ? "submitted" : ""}>{player.seat}{game.votedSeats.includes(player.seat) && <Check size={12} aria-hidden="true" />}</span>)}</div>
      <p className="action-note" role="status">{t("已提交 {n} / {total} 票 · 提交后不能改票", { n: game.votedSeats.length, total: room.capacity })}</p>
      {me && game.myTeamVote === null ? <p className="waiting-note" role="status">{t("请在屏幕底部表决。")}</p> : <p className="waiting-note" role="status">{me ? t("你的表决已锁定，等待全员揭晓。") : t("等待房间成员完成表决。")}</p>}
    </div>}

    {room.phase === "quest" && <div className="game-action">
      <div className="game-action-heading"><span className="step-icon"><LockKeyhole size={24} aria-hidden="true" /></span><div><span className="action-kicker">{t("仅任务队员参与")}</span><h2>{t("秘密投下你的任务牌")}</h2><p>{game.failsRequired === 2 ? t("本任务至少出现 2 张失败牌才会失败。个人任务票始终保密。") : t("只要出现 1 张失败牌，本任务就会失败。个人任务票始终保密。")}</p></div></div>
      <div className="sealed-progress"><LockKeyhole size={28} strokeWidth={1.4} aria-hidden="true" /><p className="ballot-count" role="status"><b>{game.submittedQuestCount}</b> / {game.teamSize}<span>{t("任务票已密封")}</span></p></div>
      <p className="waiting-note" role="status">{onTeam && game.myQuestVote === null ? t("请在屏幕底部提交任务票。") : onTeam ? t("你的任务票已密封，等待其他队员。") : t("本次无需你投任务票，等待队员完成。")}</p>
      <p className="action-note">{t("对局中只公布失败牌总数，结局后才公开谁出了哪张牌。")}</p>
    </div>}

    {room.phase === "lake" && game.lake && <div className="game-action lake-action">
      <div className="game-action-heading"><span className="step-icon"><Waves size={25} aria-hidden="true" /></span><div><span className="action-kicker">{t("任务 {n} 结束后的私密查验", { n: game.quest })}</span><h2>{t("湖中仙女正在辨认忠诚。")}</h2><p>{t("查验只会显示阵营，不会显示具体角色。查验后，令牌交给被查验者。")}</p></div></div>
      {me?.seat===game.lake.holderSeat?<><p className="muted-copy">{t("选择一位尚未使用过湖中仙女的玩家。结果仅在你的设备上显示。")}</p><div className="team-selector">{room.players.filter(player=>player.seat!==me.seat&&!game.lake!.usedSeats.includes(player.seat)).map(player=><button key={player.id} className={`player-option ${target===player.seat?"selected":""}`} aria-pressed={target===player.seat} disabled={blocked} onClick={()=>setTarget(player.seat)}><span className="player-number">{player.seat}</span><span>{player.name}<MarkTag mark={notes.marks[player.seat]}/></span><span className="selection-check">{target===player.seat&&<Check size={15}/>}</span></button>)}</div><button className="primary-button" disabled={blocked||target===null} onClick={()=>setPending({action:"lake-check",input:{turnId:game.turnId,targetSeat:target},title:t("查验 {n} 号 · {name}？",{n:target??"",name:playerName(target!)}),description:t("确认后你会私密看到其阵营，湖中仙女令牌同时交给对方。目标不能更换。"),label:t("确认查验")})}><Waves size={18}/>{t("确认查验")}</button></>:<p className="waiting-note" role="status">{t("湖中仙女由 {n} 号 · {name} 持有，等待其完成私密查验。",{n:game.lake.holderSeat,name:playerName(game.lake.holderSeat)})}</p>}
    </div>}

    {game.publicReveals.map(item=><div className="public-reveal" key={item.seat}><Flag size={18}/><span><strong>{seatName(item.seat)}</strong> {t("已公开为 {role}。",{role:t(ROLES[item.role].name)})}</span></div>)}

    {room.phase === "assassination" && <div className="game-action assassination">
      <div className="game-action-heading"><span className="step-icon"><Swords size={27} aria-hidden="true" /></span><div><span className="action-kicker">{t("最后一次机会")}</span><h2>{t("找到梅林，逆转结局。")}</h2><p>{t("三次任务成功。邪恶阵营可以公开讨论，由刺客做出最终选择。")}</p></div></div>
      {room.identity?.role === "assassin" ? <>
        <p className="muted-copy">{t("选择你怀疑的梅林。确认后立即结算，不能更改。")}</p>
        <div className="team-selector">{room.players.filter(player => player.id !== me?.id).map(player => <button key={player.id} className={`player-option ${target === player.seat ? "selected" : ""}`} aria-pressed={target === player.seat} disabled={blocked} onClick={() => setTarget(player.seat)}><span className="player-number">{player.seat}</span><span>{player.name}<MarkTag mark={notes.marks[player.seat]} /></span><span className="selection-check">{target === player.seat && <Check size={15} />}</span></button>)}</div>
        <button className="primary-button assassination-button" disabled={blocked || target === null} onClick={() => setPending({ action: "assassinate", input: { turnId: game.turnId, targetSeat: target }, title: t("刺杀 {n} 号 · {name}？", { n: target ?? "", name: playerName(target!) }), description: t("这是一局中唯一的刺杀机会。确认后立即揭晓结局，无法撤销或重新选择。"), label: t("确认刺杀") })}><Swords size={18} />{t("确认刺杀目标")}</button>
      </> : <p className="waiting-note" role="status">{t("等待刺客选择目标。请继续保护梅林的身份。")}</p>}
    </div>}

    {room.phase === "finished" && game.result && <div className={`game-result ${game.result.winner}`}>
      <span className="result-emblem"><Trophy size={38} strokeWidth={1.3} aria-hidden="true" /></span><span className="game-kicker">THE STORY IS TOLD</span><h2>{game.result.winner === "good" ? t("正义守住了圆桌。") : t("暗影笼罩了圆桌。")}</h2><p>{t(reasonCopy[game.result.reason])}</p>{game.result.early && <p className="assassination-result">{t("刺客在对局中提前出刀，本局就此结束。")}</p>}
      {game.result.targetSeat != null && <p className="assassination-result">{t("刺杀目标：{n} 号 · {name}", { n: game.result.targetSeat, name: playerName(game.result.targetSeat) })}</p>}
      {game.revealedRoles && <HighlightList game={game} playerName={playerName} />}
      {game.revealedRoles && <div className="result-identity-list"><h3>{t("此刻，身份揭晓。")}</h3><div className="revealed-roles">{game.revealedRoles.map(player => <div key={player.seat}><span className="member-seat">{player.seat}</span><span>{playerName(player.seat)}</span><strong className={finalSide(player.role)}>{finalSide(player.role) === "good" ? <Shield size={13} aria-hidden="true" /> : <Swords size={13} aria-hidden="true" />}<RoleInfoButton role={player.role} className="revealed-role-name" />{finalSide(player.role) !== ROLES[player.role].side && <small>{finalSide(player.role) === "good" ? t("（最终属于正义）") : t("（最终属于邪恶）")}</small>}</strong></div>)}</div></div>}
      {!me && <p className="action-note">{t("完整身份仅向本局成员揭晓。")}</p>}
      <ReplayTimeline room={room} />
      <div className="rematch-actions">{me?.id === room.hostId ? <button className="primary-button" disabled={blocked} onClick={() => setPending({ action: "rematch", input: { round: room.round }, title: t("同房再来一局？"), description: t("保留房间码、玩家和座位，清除本局身份与全部投票记录。请先完成复盘；重开后所有人重新准备、重新发身份。房间仍在创建 24 小时后过期。"), label: t("确认重开") })}><RotateCcw size={17} />{t("同房再来一局")}</button> : me && <p className="waiting-note" role="status">{t("复盘完成后，可以请房主开启同房新一局。")}</p>}
      <button className="secondary-button" onClick={onNewGame}>{t("返回首页")}<ArrowRight size={16} /></button></div>
      <ReplayExport room={room} />
      <RoomRecord room={room} />
      <p className="action-note">{t("本局记录保留到同房重开或房间过期。重开前，请先完成复盘。")}</p>
    </div>}

    {lastProposal && !lastProposal.approved && room.phase === "team" && <div className="last-proposal"><Flag size={17} /><span>{t("上一支队伍未通过：{yes} 赞成 / {no} 反对。已轮到下一位队长。", { yes: lastProposal.votes.filter(vote => vote.approve).length, no: lastProposal.votes.filter(vote => !vote.approve).length })}</span></div>}

    {latestLakeCheck&&<div className="lake-private-result"><LockKeyhole size={17}/><div><small>{t("仅你可见 · 湖中仙女查验")}</small><strong>{latestLakeCheck.side==="good"?t("{n} 号 · {name} 属于正义阵营",{n:latestLakeCheck.targetSeat,name:playerName(latestLakeCheck.targetSeat)}):t("{n} 号 · {name} 属于邪恶阵营",{n:latestLakeCheck.targetSeat,name:playerName(latestLakeCheck.targetSeat)})}</strong></div></div>}

    <details id="room-log" className="game-history" open={room.phase === "finished" ? true : undefined}>
      <summary><span className="history-title"><History size={18} aria-hidden="true" /><span>{t("对局记录")}</span></span><small>{t("{p} 次表决 · {q} 次任务", { p: game.proposals.length, q: game.quests.length })}</small><ChevronDown className="history-chevron" size={17} aria-hidden="true" /></summary>
      {!game.proposals.length ? <p className="history-empty">{t("完成第一次组队表决后，记录会显示在这里。")}</p> : <VoteMatrix room={room} game={game} />}
      {game.quests.length > 0 && <div className="quest-history">{game.quests.map(quest => { const cards = game.questCards?.find(item => item.quest === quest.quest)?.cards; return <div key={quest.quest}><span>{t("任务 {n}", { n: quest.quest })}</span><span>{seatsLabel(quest.team)}</span><strong className={quest.success ? "vote-yes" : "vote-no"}>{quest.success ? t("成功") : t("失败")} · {t("{s} 张成功 · {f} 张失败", { s: quest.team.length - quest.failCount, f: quest.failCount })}</strong>{cards && cards.length > 0 && <span className="quest-cards">{cards.map(({ seat, card }) => <span key={seat} className={card === "fail" ? "vote-no" : "vote-yes"}>{t("{n} 号 · {name}：{card}", { n: seat, name: playerName(seat), card: card === "fail" ? t("失败") : t("成功") })}</span>)}</span>}</div>; })}</div>}
      <p className="action-note">{t("组队表决公开记录；任务牌在对局中只公布总数，结局后公开每个人出的牌。")}</p>
    </details>

    <AlertDialog open={!!pending} onOpenChange={open => { if (!open && !busy) setPending(null); }}>
      <AlertDialogContent className="game-confirm-dialog"><AlertDialogTitle>{pending?.title}</AlertDialogTitle><AlertDialogDescription>{pending?.description}</AlertDialogDescription>{feedback && <p className="ballot-error" role="alert">{feedback}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>{t("再想一下")}</AlertDialogCancel><AlertDialogAction disabled={blocked} onClick={event => { event.preventDefault(); void confirmPending(); }}>{busy ? t("正在提交…") : pending?.label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
