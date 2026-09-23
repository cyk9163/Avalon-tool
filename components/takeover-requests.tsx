"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Smartphone, UserCheck, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TAKEOVER_WAIT_MS, type RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

type Props = {
  room: RoomView;
  busy: boolean;
  connected: boolean;
  act: (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;
};

/** Re-renders once per second while any deadline is still in the future. */
export function useNow(deadlines: number[]) {
  const [now, setNow] = useState(() => Date.now());
  const pending = deadlines.some(deadline => deadline > now);
  useEffect(() => {
    if (!pending) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // the stored time may predate the new deadline
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [pending]);
  return now;
}

/** Host-only queue of devices asking to take over an existing seat. */
export function TakeoverRequests({ room, busy, connected, act }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState<string | null>(null);
  const requests = room.takeoverRequests;
  const now = useNow(requests.map(request => request.approvableAt));
  const pending = requests.find(request => request.id === confirming) ?? null;
  const blocked = busy || !connected;
  if (!requests.length || room.meId !== room.hostId) return null;

  async function approve() {
    if (!pending || blocked) return;
    const result = await act("takeover-approve", { requestId: pending.id, hostRevision: room.hostRevision });
    if (result) setConfirming(null);
  }

  const [askBefore, askAfter] = t("有一台新设备请求接管 {player} 的座位。").split("{player}");
  return <section className="takeover-requests" aria-label={t("换设备请求")} aria-live="polite">
    <div className="takeover-heading"><Smartphone size={17} aria-hidden="true" /><strong>{t("换设备请求")}</strong><small>{t("仅房主可见 · 15 分钟内有效")}</small></div>
    {requests.map(request => {
      // Clamp: phone clocks may differ from the server, which enforces the real window.
      const wait = Math.min(Math.ceil(TAKEOVER_WAIT_MS / 1000), Math.max(0, Math.ceil((request.approvableAt - now) / 1000)));
      return <div className="takeover-item" key={request.id}>
        <p>{askBefore}<strong>{t("{seat} 号 · {name}", { seat: request.seat, name: request.name })}</strong>{askAfter}
          <span className="takeover-code">{t("核对码")} <b>{request.verifyCode}</b></span>
          <small className="takeover-hint">{t("请看对方新手机上显示的核对码是否一致。")}{wait > 0 ? t("为让原设备有机会拒绝，{wait} 秒后可批准。", { wait }) : ""}</small>
        </p>
        <div className="takeover-actions">
          <button type="button" className="secondary-button" disabled={blocked} onClick={() => void act("takeover-deny", { requestId: request.id, hostRevision: room.hostRevision })}><X size={15} aria-hidden="true" />{t("拒绝")}</button>
          <button type="button" className="primary-button" disabled={blocked || wait > 0} onClick={() => setConfirming(request.id)}><UserCheck size={16} aria-hidden="true" />{wait > 0 ? t("{wait} 秒", { wait }) : t("核实后批准")}</button>
        </div>
      </div>;
    })}
    <AlertDialog open={!!pending} onOpenChange={open => { if (!open && !busy) setConfirming(null); }}>
      <AlertDialogContent>
        <AlertDialogTitle>{t("确认是 {seat} 号本人？", { seat: pending?.seat ?? "" })}</AlertDialogTitle>
        <AlertDialogDescription>{t("请当面确认是 {name} 在使用新设备，且新设备上的核对码是 {code}。批准后，新设备将看到这个座位的身份和线索，原来的设备立即失效；全桌都能看到这次换设备记录。", { name: pending?.name ?? "", code: pending?.verifyCode ?? "" })}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("再确认一下")}</AlertDialogCancel>
          <AlertDialogAction disabled={blocked || !pending} onClick={event => { event.preventDefault(); void approve(); }}>{busy ? t("正在提交…") : t("确认批准")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

/** Warns a seated player that another device is asking for their seat. */
export function TakeoverAlert({ room, busy, connected, act }: Props) {
  const { t } = useI18n();
  const requests = room.takeoversOfMySeat;
  if (!room.meId || !requests.length) return null;
  const [alertBefore, alertAfter] = t("一台新设备请求接管你的座位（核对码 {code}）。如果是你本人换手机，可以忽略；如果不是，请立即拒绝并告诉大家。").split("{code}");
  return <section className="takeover-requests takeover-alert" role="alert">
    <div className="takeover-heading"><ShieldAlert size={17} aria-hidden="true" /><strong>{t("有设备申请接管你的座位")}</strong></div>
    {requests.map(request => <div className="takeover-item" key={request.id}>
      <p>{alertBefore}<b>{request.verifyCode}</b>{alertAfter}</p>
      <div className="takeover-actions">
        <button type="button" className="primary-button danger" disabled={busy || !connected} onClick={() => void act("takeover-reject", { requestId: request.id })}><X size={15} aria-hidden="true" />{t("不是我，拒绝")}</button>
      </div>
    </div>)}
  </section>;
}
