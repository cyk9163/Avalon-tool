"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Crown, LoaderCircle, LockKeyhole, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import type { AdminStats } from "@/lib/admin-stats";
import { PRESETS, type Preset } from "@/lib/game";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";
import { LangToggle } from "@/components/lang-toggle";

type Stats = AdminStats & { service: { version: string; databaseMs: number; liveHub: boolean; hostKeys: number; adminKeys: number } };

const PHASES: Record<string, string> = {
  lobby: msg("大厅"), identity: msg("看身份"), ready: msg("待开局"), team: msg("选队"), vote: msg("表决"), quest: msg("任务"),
  lake: msg("湖中仙女"), assassination: msg("刺杀"), finished: msg("已结束"), closed: msg("已关闭"),
};
const RESULTS: Record<string, string> = {
  "three-failures": msg("三次任务失败"), "five-rejections": msg("五次否决"), "merlin-assassinated": msg("刺中梅林"), "assassin-missed": msg("刺杀落空"),
};
const REFRESH_MS = 30_000;

function Bars({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...rows.map(row => row.count));
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="admin-empty">{t("暂无数据")}</p> : (
        <ul className="admin-bars">
          {rows.map(row => (
            <li key={row.label}>
              <span className="admin-bar-label">{row.label}</span>
              <span className="admin-bar-track"><span className="admin-bar" style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }} /></span>
              <span className="admin-bar-value">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Hourly({ hourly }: { hourly: number[] }) {
  const { t } = useI18n();
  // Oldest on the left, the current hour on the right.
  const series = [...hourly].reverse();
  const max = Math.max(1, ...series);
  const total = series.reduce((sum, value) => sum + value, 0);
  const label = (index: number) => { const ago = 23 - index; return ago === 0 ? t("最近 1 小时") : t("{from}–{to} 小时前", { from: ago, to: ago + 1 }); };
  return (
    <section className="admin-card admin-card-wide">
      <h2>{t("过去 24 小时新建房间")}<small>{t("共 {total} 个 · 峰值 {peak} 个/小时", { total, peak: Math.max(...series) })}</small></h2>
      <div className="admin-hourly" role="img" aria-label={t("过去 24 小时每小时新建房间数，共 {total} 个", { total })}>
        {series.map((value, index) => (
          <span key={index} className="admin-hour" data-tip={t("{time}：{n} 个", { time: label(index), n: value })}>
            <span className="admin-hour-bar" style={{ height: `${value ? Math.max(4, (value / max) * 100) : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="admin-hourly-axis" aria-hidden="true"><span>{t("24 小时前")}</span><span>{t("12 小时前")}</span><span>{t("现在")}</span></div>
      <details className="admin-table-toggle">
        <summary>{t("查看表格")}</summary>
        <table><thead><tr><th scope="col">{t("时间段")}</th><th scope="col">{t("新建房间")}</th></tr></thead>
          <tbody>{series.map((value, index) => <tr key={index}><td>{label(index)}</td><td>{value}</td></tr>).reverse()}</tbody></table>
      </details>
    </section>
  );
}

export default function AdminPage() {
  const { t, ts, lang } = useI18n();
  const [key, setKey] = useState(""), [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const authorized = useRef("");

  const load = useCallback(async (typed: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin", { headers: { "X-Admin-Key": typed }, cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({ error: msg("管理后台暂时不可用。") })) as Partial<Stats> & { error?: string };
      if (!response.ok) {
        setError(data.error || msg("请求失败。"));
        if (response.status === 403 || response.status === 401) { authorized.current = ""; setStats(null); }
        return;
      }
      authorized.current = typed; setStats(data as Stats); setError("");
    } catch {
      setError(msg("网络连接失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh every 30 s while the dashboard is visible.
  useEffect(() => {
    if (!stats) return;
    const timer = setInterval(() => { if (!document.hidden && authorized.current) void load(authorized.current); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [stats, load]);

  const submit = (event: FormEvent) => { event.preventDefault(); if (key.trim()) void load(key.trim()); };
  const signOut = () => { authorized.current = ""; setStats(null); setKey(""); setError(""); };

  return (
    <main className="app-shell admin-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label={t("圆桌首页")}><span className="brand-icon"><Crown size={22} /></span><span>{t("圆桌")}<span className="brand-sub">ADMIN</span></span></Link>
        <div className="doc-actions"><LangToggle />
        {stats ? <button type="button" className="doc-back" onClick={signOut}><LogOut size={16} />{t("退出")}</button> : <Link className="doc-back" href="/"><ArrowLeft size={16} />{t("返回圆桌")}</Link>}</div>
      </header>

      {!stats ? (
        <form className="admin-login" onSubmit={submit}>
          <span className="admin-login-icon"><LockKeyhole size={24} /></span>
          <h1>{t("管理后台")}</h1>
          <p>{t("只供站点运营者查看汇总统计。玩家和房主不需要这个页面。")}</p>
          <label className="admin-field"><span>{t("管理员 Key")}</span>
            <input type="password" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ADM-XXXX-XXXX-XXXX-XXXX-XXXX" maxLength={64} value={key} onChange={event => setKey(event.target.value)} required />
          </label>
          {error && <p className="admin-error" role="alert">{ts(error)}</p>}
          <button className="primary-button" disabled={loading || !key.trim()}>{loading ? <><LoaderCircle size={17} className="spin" />{t("正在验证…")}</> : t("查看统计")}</button>
          <p className="admin-note">{t("Key 只保存在这个页面的内存里，关闭或刷新页面后需要重新输入。")}</p>
        </form>
      ) : (
        <div className="admin-dashboard">
          <div className="admin-head">
            <div><span className="doc-eyebrow">Operations</span><h1>{t("运营概况")}</h1><p className="admin-note">{t("全部为汇总计数，不含房间码、昵称、身份或投票；只统计 24 小时内未过期的房间。每 30 秒自动刷新。")}</p></div>
            <button type="button" className="doc-back" onClick={() => void load(authorized.current)} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : undefined} />{t("刷新")}</button>
          </div>
          {error && <p className="admin-error" role="alert">{ts(error)}</p>}

          <div className="admin-tiles">
            <div className="admin-tile"><small>{t("当前房间")}</small><strong>{stats.rooms.active}</strong></div>
            <div className="admin-tile"><small>{t("在座玩家")}</small><strong>{stats.rooms.players}</strong></div>
            <div className="admin-tile"><small>{t("最近 1 小时新建")}</small><strong>{stats.rooms.createdLastHour}</strong></div>
            <div className="admin-tile"><small>{t("累计局次（含重开）")}</small><strong>{stats.rooms.roundsPlayed}</strong></div>
          </div>

          <div className="admin-grid">
            <Hourly hourly={stats.hourly} />
            <Bars title={t("房间所处阶段")} rows={Object.entries(stats.phases).map(([phase, count]) => ({ label: PHASES[phase] ? t(PHASES[phase]) : phase, count })).sort((a, b) => b.count - a.count)} />
            <Bars title={t("已结束对局的结果")} rows={stats.results.map(row => ({ label: `${row.winner === "good" ? t("正义") : row.winner === "evil" ? t("邪恶") : t("未知")} · ${RESULTS[row.reason] ? t(RESULTS[row.reason]) : row.reason}`, count: row.count })).sort((a, b) => b.count - a.count)} />
            <Bars title={t("人数")} rows={Object.entries(stats.capacities).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([capacity, count]) => ({ label: t("{n} 人", { n: capacity }), count }))} />
            <Bars title={t("板子")} rows={Object.entries(stats.presets).map(([preset, count]) => ({ label: PRESETS[preset as Preset] ? t(PRESETS[preset as Preset].name) : preset, count })).sort((a, b) => b.count - a.count)} />
            <section className="admin-card">
              <h2><ShieldAlert size={17} />{t("防护")}</h2>
              <dl className="admin-facts">
                <div><dt>{t("生效中的限流记录")}</dt><dd>{stats.limits.activeBuckets}</dd></div>
                <div><dt>{t("因乱猜房间码被拦的网络")}</dt><dd>{stats.limits.blockedNetworks}</dd></div>
                <div><dt>{t("恢复码错误过多被锁")}</dt><dd>{stats.limits.blockedRecoveries}</dd></div>
              </dl>
            </section>
            <section className="admin-card">
              <h2><Activity size={17} />{t("服务")}</h2>
              <dl className="admin-facts">
                <div><dt>{t("版本")}</dt><dd>{stats.service.version}</dd></div>
                <div><dt>{t("统计查询耗时")}</dt><dd>{stats.service.databaseMs} ms</dd></div>
                <div><dt>{t("实时同步")}</dt><dd>{stats.service.liveHub ? t("已启用") : t("未配置")}</dd></div>
                <div><dt>{t("房主 Key 数")}</dt><dd>{stats.service.hostKeys}</dd></div>
                <div><dt>{t("管理员 Key 数")}</dt><dd>{stats.service.adminKeys}</dd></div>
                <div><dt>{t("统计时间")}</dt><dd>{new Date(stats.generatedAt).toLocaleTimeString(lang === "en" ? "en-GB" : "zh-CN", { hour12: false })}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
