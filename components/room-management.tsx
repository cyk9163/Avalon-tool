"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Crown, Settings2, Square, UserMinus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { RoomView } from "@/lib/game";

type Props = {
  room: RoomView;
  busy: boolean;
  connected: boolean;
  error: string;
  act: (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;
};

type ManagementAction = "transfer-host" | "kick" | "abort";
type Pending = {
  action: ManagementAction;
  input: { round: number; hostRevision: number; targetPlayerId?: string };
  phase: RoomView["phase"];
  hostId: string;
  title: string;
  description: string;
  label: string;
};

const activePhases = new Set<RoomView["phase"]>(["identity", "ready", "team", "vote", "quest", "assassination"]);

export function RoomManagement({ room, busy, connected, error, act }: Props) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const isHost = !!room.meId && room.meId === room.hostId;
  const blocked = busy || !connected;
  const candidates = room.players.filter(player => player.id !== room.hostId);
  const target = candidates.find(player => player.id === targetId);
  const canAbort = activePhases.has(room.phase);
  const feedback = !connected ? "连接暂时中断，恢复后才能管理房间。" : error;
  const pendingIsCurrent = !!pending && isHost && room.phase !== "closed"
    && pending.hostId === room.hostId && pending.phase === room.phase
    && pending.input.round === room.round && pending.input.hostRevision === room.hostRevision
    && (!pending.input.targetPlayerId || candidates.some(player => player.id === pending.input.targetPlayerId));

  useEffect(() => {
    if (targetId && !target) setTargetId(null);
  }, [targetId, target]);

  // Close stale confirmations immediately when seats, authority or game phase change.
  useEffect(() => {
    if (pending && !pendingIsCurrent) setPending(null);
  }, [pending, pendingIsCurrent]);

  function prepare(action: ManagementAction, button: HTMLButtonElement) {
    if (blocked || !isHost || room.phase === "closed") return;
    if (action === "abort" ? !canAbort : !target) return;
    if (action === "kick" && room.phase !== "lobby") return;
    opener.current = button;
    const input = {
      round: room.round,
      hostRevision: room.hostRevision,
      ...(action !== "abort" && target ? { targetPlayerId: target.id } : {}),
    };
    const playerLabel = target ? `${target.seat} 号 · ${target.name}` : "";
    const copy = action === "transfer-host" ? {
      title: `把房主交给 ${playerLabel}？`,
      description: "对方将接管房间管理和开局权限。你继续留在原座位，当前进度保留。",
      label: "确认移交房主",
    } : action === "kick" ? {
      title: `将 ${playerLabel} 移出房间？`,
      description: "移出后会空出这个座位，方便另一位朋友加入。此操作不会禁止对方再次加入。",
      label: "确认移出",
    } : {
      title: "中止当前对局？",
      description: "本局将立即中止，不判定胜负，也不揭晓身份。身份和全部对局记录会被清除；玩家与座位保留，回到准备大厅。之后所有人重新准备、重新发身份，房间过期时间不变。",
      label: "中止并回到大厅",
    };
    setPending({ action, input, phase: room.phase, hostId: room.hostId, ...copy });
  }

  async function confirm() {
    if (!pending || !pendingIsCurrent || blocked) return;
    const result = await act(pending.action, pending.input);
    if (result) setPending(null);
  }

  if (!isHost || room.phase === "closed") return null;

  return <>
    <details className="room-management">
      <summary><span className="management-summary-icon"><Settings2 size={17} aria-hidden="true" /></span><span>房间管理</span><small>仅房主可操作</small><ChevronDown className="management-chevron" size={16} aria-hidden="true" /></summary>
      <div className="management-content">
        <p className="management-intro">{room.phase === "lobby" ? "准备开局前，可移交房主或调整入座玩家。" : "可以把房主交给另一位朋友，当前对局进度会保留。"}</p>
        {candidates.length ? <>
          <fieldset className="management-players">
            <legend>选择一位玩家</legend>
            <div className="management-player-grid">{candidates.map(player => <button
              key={player.id}
              type="button"
              className={`management-player ${targetId === player.id ? "selected" : ""}`}
              aria-label={`选择 ${player.seat} 号 ${player.name}`}
              aria-pressed={targetId === player.id}
              disabled={blocked}
              onClick={() => setTargetId(current => current === player.id ? null : player.id)}
            ><span className="management-seat">{player.seat}</span><span className="management-name">{player.name}</span><span className="management-selection">{targetId === player.id && <Check size={13} aria-hidden="true" />}</span></button>)}</div>
          </fieldset>
          <div className="management-actions">
            <button type="button" className="secondary-button" disabled={blocked || !target} onClick={event => prepare("transfer-host", event.currentTarget)}><Crown size={16} aria-hidden="true" />移交房主</button>
            {room.phase === "lobby" && <button type="button" className="secondary-button management-remove" disabled={blocked || !target} onClick={event => prepare("kick", event.currentTarget)}><UserMinus size={16} aria-hidden="true" />移出玩家</button>}
          </div>
        </> : <p className="management-empty">等其他朋友入座后，可以移交房主或调整玩家。</p>}
        {canAbort && <div className="management-abort">
          <div><strong>有人临时离场？</strong><p>可以中止本局，回到大厅调整玩家后重新开始。</p></div>
          <button type="button" className="secondary-button management-remove" disabled={blocked} onClick={event => prepare("abort", event.currentTarget)}><Square size={15} aria-hidden="true" />中止本局</button>
        </div>}
        {!connected && <p className="management-connection" role="status">{feedback}</p>}
      </div>
    </details>
    <AlertDialog open={pendingIsCurrent} onOpenChange={open => { if (!open && !busy) setPending(null); }}>
      <AlertDialogContent className={`management-dialog ${pending?.action === "kick" || pending?.action === "abort" ? "management-dialog-destructive" : ""}`} onCloseAutoFocus={event => {
        if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
      }}>
        <div className="management-dialog-symbol" aria-hidden="true">{pending?.action === "abort" ? <Square size={23} /> : pending?.action === "kick" ? <UserMinus size={25} /> : <Crown size={25} />}</div>
        <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
        <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        {feedback && <p className="management-error" role="alert">{feedback}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction variant={pending?.action === "kick" || pending?.action === "abort" ? "destructive" : "default"} disabled={blocked || !pendingIsCurrent} onClick={event => { event.preventDefault(); void confirm(); }}>{busy ? "正在提交…" : pending?.label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
