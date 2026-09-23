"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, LoaderCircle, Smartphone, UserCheck, X } from "lucide-react";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

type Act = (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;

/** Shown to a seated player: the one-time code that moves this seat to another device. */
export function RecoveryCodeCard({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const code = room.recoveryCode;
  // Hide again whenever the code rotates (after a recovery on another device).
  const [shownFor, setShownFor] = useState(code);
  if (shownFor !== code) { setShownFor(code); setVisible(false); setCopied(false); }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true); setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopyFailed(true); }
  }

  return <section className="config-card recovery-card" aria-labelledby="recovery-card-title">
    <div className="config-heading"><h3 id="recovery-card-title"><KeyRound size={15} aria-hidden="true" />{t("换设备恢复码")}</h3><span>{t("仅你可见")}</span></div>
    {code ? <>
      <div className="recovery-code-row">
        <code className={`recovery-code ${visible ? "" : "masked"}`} aria-live="polite">{visible ? code : "•••••-•••••"}</code>
        <button type="button" className="icon-text-button" onClick={() => setVisible(value => !value)} aria-pressed={visible} onBlur={() => setVisible(false)}>
          {visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}{visible ? t("隐藏") : t("显示")}
        </button>
        <button type="button" className="icon-text-button" onClick={() => void copy()}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? t("已复制") : t("复制")}
        </button>
      </div>
      <p className="action-note">{t("手机没电或换浏览器时，在新设备打开本房间，选择「我本来就在这桌，换了设备」并输入此码即可回到座位。原设备会立即失效，恢复码用后自动更换。请勿给别人看。")}</p>
      {copyFailed && <p className="action-note" role="status">{t("无法复制，请手动记下。")}</p>}
    </> : <p className="action-note">{t("这个房间创建于旧版本，没有恢复码。需要换设备时，可以请房主批准接管你的座位。")}</p>}
  </section>;
}

/** Shown to a device that is not seated: return to an existing seat on this device. */
export function SeatRecovery({ room, busy, connected, act }: { room: RoomView; busy: boolean; connected: boolean; act: Act }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [seat, setSeat] = useState<number | null>(null);
  const [method, setMethod] = useState<"code" | "host">("code");
  const [code, setCode] = useState("");
  const blocked = busy || !connected;
  const request = room.myTakeover;
  const hostSeat = room.players.find(player => player.id === room.hostId)?.seat ?? null;
  const occupied = [...room.players].sort((a, b) => a.seat - b.seat);
  const chosen = occupied.find(player => player.seat === seat) ? seat : null;

  if (!occupied.length) return null;

  if (request) {
    return <div className="seat-recovery waiting" role="status">
      <span className="seat-recovery-icon"><LoaderCircle size={18} className="spin" aria-hidden="true" /></span>
      <div>
        <strong>{t("已请求接管 {seat} 号座位", { seat: request.seat })}</strong>
        <p className="takeover-code large">{t("核对码")} <b>{request.verifyCode}</b></p>
        <p>{t("请把这个号码给房主看，房主核对一致后批准（发出请求 1 分钟后才能批准，原设备可在此期间拒绝）。批准后，这台设备会自动显示你的身份。")}</p>
        <button type="button" className="text-button subtle" disabled={blocked} onClick={() => void act("takeover-cancel")}><X size={15} aria-hidden="true" />{t("撤回请求")}</button>
      </div>
    </div>;
  }

  if (!open) {
    return <button type="button" className="secondary-button wide seat-recovery-toggle" onClick={() => setOpen(true)}>
      <Smartphone size={16} aria-hidden="true" />{t("我本来就在这桌，换了设备")}
    </button>;
  }

  async function submit() {
    if (!chosen || blocked) return;
    if (method === "code") {
      const result = await act("recover", { seat: chosen, recoveryCode: code });
      if (result?.meId) { setCode(""); setOpen(false); }
    } else {
      await act("takeover-request", { seat: chosen });
    }
  }

  return <form className="seat-recovery" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <div className="seat-recovery-heading"><strong>{t("回到原来的座位")}</strong><button type="button" className="icon-button small" aria-label={t("收起")} onClick={() => setOpen(false)}><X size={16} /></button></div>
    <fieldset>
      <legend>{t("你原来坐在几号？")}</legend>
      <div className="seat-recovery-seats">{occupied.map(player => <button
        key={player.id} type="button" aria-pressed={chosen === player.seat}
        className={chosen === player.seat ? "selected" : ""}
        onClick={() => setSeat(player.seat)}
      >{player.seat}{player.name ? <small>{player.name}</small> : null}</button>)}</div>
    </fieldset>
    <div className="seat-recovery-methods" role="radiogroup" aria-label={t("恢复方式")}>
      <button type="button" role="radio" aria-checked={method === "code"} className={method === "code" ? "selected" : ""} onClick={() => setMethod("code")}><KeyRound size={15} aria-hidden="true" />{t("输入恢复码")}</button>
      <button type="button" role="radio" aria-checked={method === "host"} className={method === "host" ? "selected" : ""} onClick={() => setMethod("host")}><UserCheck size={15} aria-hidden="true" />{t("请房主批准")}</button>
    </div>
    {method === "code" ? <label className="field">{t("恢复码")}
      <input className="recovery-input" value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={13} inputMode="text" />
    </label> : <p className="action-note">{chosen !== null && chosen === hostSeat ? t("房主的座位只能用恢复码恢复。") : t("房主批准前请当面确认是你本人。批准后，原来的设备会立即失效。")}</p>}
    <button className="primary-button" disabled={blocked || !chosen || (method === "code" ? code.replace(/[\s-]/g, "").length !== 10 : chosen === hostSeat)}>
      {method === "code" ? t("恢复座位") : t("发送请求")}
    </button>
  </form>;
}
