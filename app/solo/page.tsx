"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BUILT_IN_TEMPLATES, fillCustomRoles, loadSavedTemplates, sameBoard, templateFits, templateMinimum, type BoardTemplate } from "@/lib/board-templates";
import { CUSTOM_EVIL_ROLES, CUSTOM_GOOD_ROLES, EVIL_COUNTS, PRESETS, ROLES, type Preset, type Role, type RoomView } from "@/lib/game";
import { hostKeyBody, hostKeyForSubmit, formatHostKey } from "@/lib/host-key-input";
import { useI18n } from "@/lib/i18n/react";
import { SOLO_NAMES, isControlHost, isSoloHost } from "@/lib/solo";

type Table = { code: string; invite: string | null; capacity: number; devices: string[] };
type Desk = "local" | "staging" | "blocked";

function deskMode(): Desk {
  if (!isControlHost(location.hostname)) return "blocked";
  return isSoloHost(location.hostname) ? "local" : "staging";
}

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
  const [knowsOberon, setKnowsOberon] = useState(false);
  const [customSpecials, setCustomSpecials] = useState<Set<Role>>(() => new Set(["merlin", "assassin"]));
  const [ladyOfLake, setLadyOfLake] = useState(false);
  const [savedTemplates] = useState<BoardTemplate[]>(() => typeof window === "undefined" ? [] : loadSavedTemplates());
  const [table, setTable] = useState<Table | null>(null);
  const [booting, setBooting] = useState(false);
  const [error, setError] = useState("");
  const [origins, setOrigins] = useState<string[]>([]);
  const [origin, setOrigin] = useState("");
  const [phoneSeat, setPhoneSeat] = useState<number | null>(null);
  const [qrImage, setQrImage] = useState<{ url: string; data: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostKey, setHostKey] = useState("");
  const desk = useSyncExternalStore(() => () => {}, deskMode, () => "local" as const);
  const remote = desk === "staging";
  const customRoles = fillCustomRoles(capacity, customSpecials);

  const toggleCustomRole = (role: Role) => {
    if (role === "merlin" || role === "assassin") return;
    setCustomSpecials(current => {
      const next = new Set(current);
      const adding = !next.has(role);
      const paired: Role[] = role === "goodLancelot" || role === "evilLancelot" ? ["goodLancelot", "evilLancelot"] : [role];
      if (adding) { for (const item of paired) next.add(item); if (role === "morgana") next.add("percival"); }
      else { for (const item of paired) next.delete(item); if (role === "percival") next.delete("morgana"); if (role === "oberon") setKnowsOberon(false); }
      const good = [...next].filter(item => ROLES[item].side === "good").length;
      const evil = [...next].filter(item => ROLES[item].side === "evil").length;
      return good <= capacity - EVIL_COUNTS[capacity] && evil <= EVIL_COUNTS[capacity] ? next : current;
    });
  };

  const start = async () => {
    setError("");
    setBooting(true);
    try {
      let roomKey = hostKeyForSubmit(hostKey);
      if (!remote) {
        const setup = await fetch("/api/solo");
        if (!setup.ok) throw new Error(t("本地测试接口不可用。"));
        roomKey = (await setup.json() as { hostKey: string }).hostKey;
      } else if (hostKey.length !== 16) throw new Error(t("请填写测试站的房主 Key。"));
      const devices = Array.from({ length: capacity }, deviceId);
      const response = await fetch("/api/room", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Avalon-Solo": devices[0] },
        body: JSON.stringify({
          action: "create",
          name: SOLO_NAMES[0],
          hostKey: roomKey,
          capacity,
          preset,
          turnSpeech,
          evilSeesOberon: (preset === "full" || (preset === "custom" && customSpecials.has("oberon"))) && knowsOberon,
          ...(preset === "custom" ? { roles: customRoles, ladyOfLake } : {}),
          requestId: crypto.randomUUID(),
        }),
      });
      const room = await response.json() as RoomView & { error?: string };
      if (!response.ok) throw new Error(room.error || t("建房失败。"));
      setPhoneSeat(null);
      setTable({ code: room.code, invite: room.inviteToken, capacity: room.capacity, devices });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("建房失败。"));
    } finally {
      setBooting(false);
    }
  };

  const publicOrigin = remote ? location.origin : "";
  useEffect(() => {
    if (!table || publicOrigin) return;
    let cancelled = false;
    fetch("/api/dev-lan").then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { origins?: unknown };
      if (cancelled || !Array.isArray(body.origins)) return;
      const next = body.origins.filter((item): item is string => typeof item === "string" && item.startsWith("http://"));
      setOrigins(next);
      setOrigin(current => current && next.includes(current) ? current : next.find(item => item.includes("://192.168.")) ?? next[0] ?? "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [table, publicOrigin]);

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
  const phoneBase = publicOrigin || origin;
  const soloColumns = !table ? 3 : table.capacity <= 4 ? table.capacity : table.capacity <= 6 ? 3 : 4;
  const phoneTarget = table && phoneSeat && phoneBase ? `${phoneBase}${phoneSrc(phoneSeat)}` : "";
  const qr = qrImage?.url === phoneTarget ? qrImage.data : "";
  useEffect(() => {
    if (!phoneTarget) return;
    let cancelled = false;
    import("qrcode").then(QR => QR.toDataURL(phoneTarget, { width: 280, margin: 2, color: { dark: "#101c22", light: "#ffffff" }, errorCorrectionLevel: "M" }))
      .then(data => { if (!cancelled) setQrImage({ url: phoneTarget, data }); })
      .catch(() => { if (!cancelled) setQrImage(null); });
    return () => { cancelled = true; };
  }, [phoneTarget]);

  if (desk === "blocked") return <main className="app-shell"><p>{t("一个人测试只在本地开发服务器上可用。")}</p></main>;

  return <main className="app-shell solo-desk">
    <header className="solo-head">
      <div>
        <h1>{t("一个人测试整桌")}</h1>
        <p>{t("电脑上每个窗口是一个座位，用来总控整桌。建好房间后，点某个号的「手机接管」，扫码即可用手机操作那一个号。")}</p>
      </div>
      {table && <p className="solo-code">{t("房间码")} {table.code} <button type="button" className="text-button" onClick={() => { setTable(null); setPhoneSeat(null); setError(""); }}>{t("再摆一桌")}</button></p>}
    </header>
    {!table && <form className="solo-setup entry-panel" onSubmit={event => { event.preventDefault(); void start(); }}>
      <fieldset><legend>{t("这次有几位朋友？")}</legend><RadioGroup aria-label={t("游戏人数")} className="count-grid" value={String(capacity)} onValueChange={value => { const next = Number(value); setCapacity(next); if (next < PRESETS[preset].minimum) setPreset("classic"); if (ladyOfLake && next < 7) setLadyOfLake(false); }}>{[5, 6, 7, 8, 9, 10].map(count => <label className={`count-option ${capacity === count ? "selected" : ""}`} key={count}><RadioGroupItem value={String(count)} className="sr-only" /><strong>{count}</strong><span>{t("人")}</span></label>)}</RadioGroup></fieldset>
      <fieldset><legend>{t("选择角色配置")}</legend><RadioGroup aria-label={t("角色配置")} value={preset} onValueChange={value => setPreset(value as Preset)} className="preset-grid">{(Object.keys(PRESETS) as Preset[]).map(key => <label className={`preset-choice ${key === preset ? "selected" : ""} ${capacity < PRESETS[key].minimum ? "unavailable" : ""}`} key={key}><RadioGroupItem value={key} disabled={capacity < PRESETS[key].minimum} /><div><strong>{t(PRESETS[key].name)}</strong><span>{t(PRESETS[key].hint)}</span></div></label>)}</RadioGroup></fieldset>
      <fieldset className="template-picker"><legend>{t("推荐板子")}</legend><div className="template-chips">{[...BUILT_IN_TEMPLATES, ...savedTemplates].map(template => { const fits = templateFits(template, capacity); const active = preset === "custom" && sameBoard(template, customSpecials, ladyOfLake); return <span key={template.id} className={`template-chip${active ? " selected" : ""}`}><button type="button" disabled={!fits} aria-pressed={active} onClick={() => { setPreset("custom"); setCustomSpecials(new Set(template.specials)); setLadyOfLake(template.ladyOfLake); }}><span>{template.builtIn ? t(template.name) : template.name}</span><small>{fits ? (template.hint ? t(template.hint) : template.ladyOfLake ? t("我的模板 · 湖中仙女") : t("我的模板")) : t("{n} 人起", { n: templateMinimum(template) ?? "" })}</small></button></span>; })}</div></fieldset>
      {preset === "custom" && <fieldset className="custom-board"><legend>{t("编辑自定义板子")}</legend><div className="custom-board-summary"><span>{t("正义 {n} 位", { n: capacity - EVIL_COUNTS[capacity] })}</span><span>{t("邪恶 {n} 位", { n: EVIL_COUNTS[capacity] })}</span></div><div className="custom-role-columns"><div><strong>{t("正义角色")}</strong>{CUSTOM_GOOD_ROLES.map(role => <button type="button" key={role} className={customSpecials.has(role) ? "selected" : ""} aria-pressed={customSpecials.has(role)} disabled={role === "merlin" || (capacity < 7 && ["goodLancelot", "cleric"].includes(role))} onClick={() => toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span></button>)}</div><div><strong>{t("邪恶角色")}</strong>{CUSTOM_EVIL_ROLES.map(role => <button type="button" key={role} className={customSpecials.has(role) ? "selected" : ""} aria-pressed={customSpecials.has(role)} disabled={role === "assassin" || (capacity < 7 && ["evilLancelot", "lunatic", "brute", "revealer"].includes(role))} onClick={() => toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span></button>)}</div></div><label className={`module-toggle ${capacity < 7 ? "disabled" : ""}`}><input type="checkbox" checked={ladyOfLake} disabled={capacity < 7} onChange={event => setLadyOfLake(event.target.checked)} /><span><strong>{t("启用湖中仙女")}</strong><small>{t("第 2、3、4 次任务后，持有者私密查验一位玩家的阵营")}</small></span></label></fieldset>}
      <label className="module-toggle"><input type="checkbox" checked={turnSpeech} onChange={event => setTurnSpeech(event.target.checked)} /><span><strong>{t("轮流发言")}</strong><small>{t("每人说完要点「我说完了」，并可以计时。不勾选时，队长亮车，大家讨论完直接表决。")}</small></span></label>
      <label className="module-toggle"><input type="checkbox" checked={knowsOberon} onChange={event => { if (!event.target.checked) { setKnowsOberon(false); return; } if (!(preset === "full" || (preset === "custom" && customSpecials.has("oberon")))) { const base = preset === "custom" ? new Set(customSpecials) : new Set<Role>(["merlin", "assassin"]); if ([...base].filter(role => ROLES[role].side === "evil").length >= EVIL_COUNTS[capacity]) return; base.add("oberon"); setPreset("custom"); setCustomSpecials(base); } setKnowsOberon(true); }} /><span><strong>{t("坏人认识奥伯伦")}</strong><small>{t("坏人知道奥伯伦是谁，奥伯伦不知道队友。勾选后会把奥伯伦加入板子。")}</small></span></label>
      {remote && <label className="field">{t("房主 Key")}<input value={formatHostKey(hostKey)} onChange={event => setHostKey(hostKeyBody(event.target.value))} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" /></label>}
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={booting || (remote && hostKey.length !== 16) || (preset !== "custom" && capacity < PRESETS[preset].minimum)}>{booting ? t("正在摆桌子…") : t("摆好一桌")}</button>
    </form>}
    {table && <div className="solo-grid" style={{ ["--solo-cols" as string]: soloColumns }}>{Array.from({ length: table.capacity }, (_, index) => {
      const seat = index + 1;
      const open = phoneSeat === seat;
      return <section key={seat} className="solo-phone">
        <div className="solo-phone-bar"><h2>{t("{n} 号", { n: seat })} · {SOLO_NAMES[index]}</h2><button type="button" className="text-button" aria-expanded={open} onClick={() => { setCopied(false); setPhoneSeat(open ? null : seat); }}>{t("手机接管")}</button></div>
        {open && <div className="solo-phone-link">
          {origins.length > 1 && <label className="field">{t("手机要打开的地址")}<select value={origin} onChange={event => setOrigin(event.target.value)}>{origins.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
          {qr ? /* eslint-disable-next-line @next/next/no-img-element -- a locally generated data: URL; image optimisation does not apply. */
            <img src={qr} alt={t("用手机打开 {name} 的界面", { name: SOLO_NAMES[index] ?? String(seat) })} width={168} height={168} /> : <p>{phoneTarget ? t("正在生成二维码…") : t("这台电脑的局域网地址还没找到。重启本地开发服务器后再试。")}</p>}
          {phoneTarget && <button type="button" className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(phoneTarget); setCopied(true); } catch { setCopied(false); } }}>{copied ? t("已复制手机链接") : t("复制手机链接")}</button>}
          <p>{t("扫码后，这台手机会接管这个号。电脑上的其他窗口仍可总控整桌。")}</p>
        </div>}
        <iframe title={t("{n} 号", { n: seat })} src={phoneSrc(seat)} />
      </section>;
    })}</div>}
  </main>;
}
