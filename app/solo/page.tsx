"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BUILT_IN_TEMPLATES, fillCustomRoles, loadSavedTemplates, sameBoard, templateFits, templateMinimum, type BoardTemplate } from "@/lib/board-templates";
import { CUSTOM_EVIL_ROLES, CUSTOM_GOOD_ROLES, EVIL_COUNTS, PRESETS, ROLES, type Preset, type Role, type RoomView } from "@/lib/game";
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
  const [customSpecials, setCustomSpecials] = useState<Set<Role>>(() => new Set(["merlin", "assassin"]));
  const [ladyOfLake, setLadyOfLake] = useState(false);
  const [savedTemplates] = useState<BoardTemplate[]>(() => typeof window === "undefined" ? [] : loadSavedTemplates());
  const [table, setTable] = useState<Table | null>(null);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState("");
  const local = typeof location === "undefined" || isSoloHost(location.hostname);
  const customRoles = fillCustomRoles(capacity, customSpecials);

  const toggleCustomRole = (role: Role) => {
    if (role === "merlin" || role === "assassin") return;
    setCustomSpecials(current => {
      const next = new Set(current);
      const adding = !next.has(role);
      const paired: Role[] = role === "goodLancelot" || role === "evilLancelot" ? ["goodLancelot", "evilLancelot"] : [role];
      if (adding) { for (const item of paired) next.add(item); if (role === "morgana") next.add("percival"); }
      else { for (const item of paired) next.delete(item); if (role === "percival") next.delete("morgana"); }
      const good = [...next].filter(item => ROLES[item].side === "good").length;
      const evil = [...next].filter(item => ROLES[item].side === "evil").length;
      return good <= capacity - EVIL_COUNTS[capacity] && evil <= EVIL_COUNTS[capacity] ? next : current;
    });
  };

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
        body: JSON.stringify({
          action: "create",
          name: SOLO_NAMES[0],
          hostKey,
          capacity,
          preset,
          turnSpeech,
          ...(preset === "custom" ? { roles: customRoles, ladyOfLake } : {}),
          requestId: crypto.randomUUID(),
        }),
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
      {table && <p className="solo-code">{t("房间码")} {table.code} <button type="button" className="text-button" onClick={() => { setTable(null); setError(""); }}>{t("再摆一桌")}</button></p>}
    </header>
    {!table && <form className="solo-setup entry-panel" onSubmit={event => { event.preventDefault(); void start(); }}>
      <fieldset><legend>{t("这次有几位朋友？")}</legend><RadioGroup aria-label={t("游戏人数")} className="count-grid" value={String(capacity)} onValueChange={value => { const next = Number(value); setCapacity(next); if (next < PRESETS[preset].minimum) setPreset("classic"); if (ladyOfLake && next < 7) setLadyOfLake(false); }}>{[5, 6, 7, 8, 9, 10].map(count => <label className={`count-option ${capacity === count ? "selected" : ""}`} key={count}><RadioGroupItem value={String(count)} className="sr-only" /><strong>{count}</strong><span>{t("人")}</span></label>)}</RadioGroup></fieldset>
      <fieldset><legend>{t("选择角色配置")}</legend><RadioGroup aria-label={t("角色配置")} value={preset} onValueChange={value => setPreset(value as Preset)} className="preset-grid">{(Object.keys(PRESETS) as Preset[]).map(key => <label className={`preset-choice ${key === preset ? "selected" : ""} ${capacity < PRESETS[key].minimum ? "unavailable" : ""}`} key={key}><RadioGroupItem value={key} disabled={capacity < PRESETS[key].minimum} /><div><strong>{t(PRESETS[key].name)}</strong><span>{t(PRESETS[key].hint)}</span></div></label>)}</RadioGroup></fieldset>
      <fieldset className="template-picker"><legend>{t("推荐板子")}</legend><div className="template-chips">{[...BUILT_IN_TEMPLATES, ...savedTemplates].map(template => { const fits = templateFits(template, capacity); const active = preset === "custom" && sameBoard(template, customSpecials, ladyOfLake); return <span key={template.id} className={`template-chip${active ? " selected" : ""}`}><button type="button" disabled={!fits} aria-pressed={active} onClick={() => { setPreset("custom"); setCustomSpecials(new Set(template.specials)); setLadyOfLake(template.ladyOfLake); }}><span>{template.builtIn ? t(template.name) : template.name}</span><small>{fits ? (template.hint ? t(template.hint) : template.ladyOfLake ? t("我的模板 · 湖中仙女") : t("我的模板")) : t("{n} 人起", { n: templateMinimum(template) ?? "" })}</small></button></span>; })}</div></fieldset>
      {preset === "custom" && <fieldset className="custom-board"><legend>{t("编辑自定义板子")}</legend><div className="custom-board-summary"><span>{t("正义 {n} 位", { n: capacity - EVIL_COUNTS[capacity] })}</span><span>{t("邪恶 {n} 位", { n: EVIL_COUNTS[capacity] })}</span></div><div className="custom-role-columns"><div><strong>{t("正义角色")}</strong>{CUSTOM_GOOD_ROLES.map(role => <button type="button" key={role} className={customSpecials.has(role) ? "selected" : ""} aria-pressed={customSpecials.has(role)} disabled={role === "merlin" || (capacity < 7 && ["goodLancelot", "cleric"].includes(role))} onClick={() => toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span></button>)}</div><div><strong>{t("邪恶角色")}</strong>{CUSTOM_EVIL_ROLES.map(role => <button type="button" key={role} className={customSpecials.has(role) ? "selected" : ""} aria-pressed={customSpecials.has(role)} disabled={role === "assassin" || (capacity < 7 && ["evilLancelot", "lunatic", "brute", "revealer"].includes(role))} onClick={() => toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span></button>)}</div></div><label className={`module-toggle ${capacity < 7 ? "disabled" : ""}`}><input type="checkbox" checked={ladyOfLake} disabled={capacity < 7} onChange={event => setLadyOfLake(event.target.checked)} /><span><strong>{t("启用湖中仙女")}</strong><small>{t("第 2、3、4 次任务后，持有者私密查验一位玩家的阵营")}</small></span></label></fieldset>}
      <label className="module-toggle"><input type="checkbox" checked={turnSpeech} onChange={event => setTurnSpeech(event.target.checked)} /><span><strong>{t("轮流发言")}</strong><small>{t("每人说完要点「我说完了」，并可以计时。不勾选时，队长亮车，大家讨论完直接表决。")}</small></span></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={booting || (preset !== "custom" && capacity < PRESETS[preset].minimum)}>{booting ? t("正在摆桌子…") : t("摆好一桌")}</button>
    </form>}
    {table && <div className="solo-grid">{Array.from({ length: table.capacity }, (_, index) => {
      const seat = index + 1;
      return <section key={seat} className="solo-phone"><h2>{t("{n} 号", { n: seat })} · {SOLO_NAMES[index]}</h2><iframe title={t("{n} 号", { n: seat })} src={phoneSrc(seat)} /></section>;
    })}</div>}
  </main>;
}
