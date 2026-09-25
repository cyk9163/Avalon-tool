"use client";

import { useState } from "react";
import { PRESETS, type Preset, type RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { SOLO_NAMES, isSoloHost } from "@/lib/solo";

type Table = { code: string; invite: string | null; capacity: number; devices: string[] };

function deviceId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export default function SoloPage() {
  const { t } = useI18n();
  const [capacity, setCapacity] = useState(5);
  const [preset, setPreset] = useState<Preset>("classic");
  const [turnSpeech, setTurnSpeech] = useState(false);
  const [table, setTable] = useState<Table | null>(null);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState("");
  const local = typeof location === "undefined" || isSoloHost(location.hostname);

  const start = async () => {
    setError("");
    setBooting(true);
    try {
      const setup = await fetch("/api/solo");
      if (!setup.ok) throw new Error(t("本地测试接口不可用。"));
      const { hostKey } = await setup.json() as { hostKey: string };
      const devices = Array.from({ length: capacity }, deviceId);
      const response = await fetch("/api/room", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Avalon-Solo": devices[0] },
        body: JSON.stringify({ action: "create", name: SOLO_NAMES[0], hostKey, capacity, preset, turnSpeech, requestId: crypto.randomUUID() }),
      });
      const room = await response.json() as RoomView & { error?: string };
      if (!response.ok) throw new Error(room.error || t("建房失败。"));
      setTable({ code: room.code, invite: room.inviteToken, capacity: room.capacity, devices });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("建房失败。"));
    } finally {
      setBooting(false);
    }
  };

  if (!local) return <main className="app-shell"><p>{t("一个人测试只在本地开发服务器上可用。")}</p></main>;

  const phoneSrc = (seat: number) => {
    if (!table) return "";
    const params = new URLSearchParams({
      room: table.code,
      solo: table.devices[seat - 1],
      soloSeat: String(seat),
      soloName: SOLO_NAMES[seat - 1] ?? String(seat),
    });
    if (table.invite) params.set("invite", table.invite);
    return `/?${params.toString()}`;
  };

  return <main className="app-shell solo-desk">
    <header className="solo-head">
      <div>
        <h1>{t("一个人测试整桌")}</h1>
        <p>{t("每个窗口是一个独立座位。你可以在不同窗口里看身份、投票、出牌和复盘。")}</p>
      </div>
      {!table && <form className="solo-form" onSubmit={event => { event.preventDefault(); void start(); }}>
        <label>{t("人数")}<select value={capacity} onChange={event => setCapacity(Number(event.target.value))}>{[5, 6, 7, 8, 9, 10].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
        <label>{t("板子")}<select value={preset} onChange={event => setPreset(event.target.value as Preset)}>{(Object.keys(PRESETS) as Preset[]).filter(item => item !== "custom").map(item => <option key={item} value={item}>{t(PRESETS[item].name)}</option>)}</select></label>
        <label>{t("轮流发言")}<input type="checkbox" checked={turnSpeech} onChange={event => setTurnSpeech(event.target.checked)} /></label>
        <button className="primary-button" type="submit" disabled={booting || capacity < PRESETS[preset].minimum}>{booting ? t("正在摆桌子…") : t("摆好一桌")}</button>
        <p>{t(PRESETS[preset].hint)}</p>
      </form>}
      {error && <p role="alert">{error}</p>}
      {table && <p className="solo-code">{t("房间码")} {table.code} <button type="button" className="text-button" onClick={() => { setTable(null); setError(""); }}>{t("再摆一桌")}</button></p>}
    </header>
    {table && <div className="solo-grid">{Array.from({ length: table.capacity }, (_, index) => {
      const seat = index + 1;
      return <section key={seat} className="solo-phone"><h2>{t("{n} 号", { n: seat })} · {SOLO_NAMES[index]}</h2><iframe title={t("{n} 号", { n: seat })} src={phoneSrc(seat)} /></section>;
    })}</div>}
  </main>;
}
