"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Crown, LoaderCircle, LockKeyhole, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import type { AdminStats } from "@/lib/admin-stats";
import { PRESETS, type Preset } from "@/lib/game";

type Stats = AdminStats & { service: { version: string; databaseMs: number; liveHub: boolean; hostKeys: number; adminKeys: number } };

const PHASES: Record<string, string> = {
  lobby: "大厅", identity: "看身份", ready: "待开局", team: "选队", vote: "表决", quest: "任务",
  lake: "湖中仙女", assassination: "刺杀", finished: "已结束", closed: "已关闭",
};
const RESULTS: Record<string, string> = {
  "three-failures": "三次任务失败", "five-rejections": "五次否决", "merlin-assassinated": "刺中梅林", "assassin-missed": "刺杀落空",
};
const REFRESH_MS = 30_000;

function Bars({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="admin-empty">暂无数据</p> : (
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
  // Oldest on the left, the current hour on the right.
  const series = [...hourly].reverse();
  const max = Math.max(1, ...series);
  const total = series.reduce((sum, value) => sum + value, 0);
  const label = (index: number) => { const ago = 23 - index; return ago === 0 ? "最近 1 小时" : `${ago}–${ago + 1} 小时前`; };
  return (
    <section className="admin-card admin-card-wide">
      <h2>过去 24 小时新建房间<small>共 {total} 个 · 峰值 {Math.max(...series)} 个/小时</small></h2>
      <div className="admin-hourly" role="img" aria-label={`过去 24 小时每小时新建房间数，共 ${total} 个`}>
        {series.map((value, index) => (
          <span key={index} className="admin-hour" data-tip={`${label(index)}：${value} 个`}>
            <span className="admin-hour-bar" style={{ height: `${value ? Math.max(4, (value / max) * 100) : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="admin-hourly-axis" aria-hidden="true"><span>24 小时前</span><span>12 小时前</span><span>现在</span></div>
      <details className="admin-table-toggle">
        <summary>查看表格</summary>
        <table><thead><tr><th scope="col">时间段</th><th scope="col">新建房间</th></tr></thead>
          <tbody>{series.map((value, index) => <tr key={index}><td>{label(index)}</td><td>{value}</td></tr>).reverse()}</tbody></table>
      </details>
    </section>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState(""), [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const authorized = useRef("");

  const load = useCallback(async (typed: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin", { headers: { "X-Admin-Key": typed }, cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({ error: "管理后台暂时不可用。" })) as Partial<Stats> & { error?: string };
      if (!response.ok) {
        setError(data.error || "请求失败。");
        if (response.status === 403 || response.status === 401) { authorized.current = ""; setStats(null); }
        return;
      }
      authorized.current = typed; setStats(data as Stats); setError("");
    } catch {
      setError("网络连接失败，请稍后重试。");
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
        <Link className="brand" href="/" aria-label="圆桌首页"><span className="brand-icon"><Crown size={22} /></span><span>圆桌<span className="brand-sub">ADMIN</span></span></Link>
        {stats ? <button type="button" className="doc-back" onClick={signOut}><LogOut size={16} />退出</button> : <Link className="doc-back" href="/"><ArrowLeft size={16} />返回圆桌</Link>}
      </header>

      {!stats ? (
        <form className="admin-login" onSubmit={submit}>
          <span className="admin-login-icon"><LockKeyhole size={24} /></span>
          <h1>管理后台</h1>
          <p>只供站点运营者查看汇总统计。玩家和房主不需要这个页面。</p>
          <label className="admin-field"><span>管理员 Key</span>
            <input type="password" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ADM-XXXX-XXXX-XXXX-XXXX-XXXX" maxLength={64} value={key} onChange={event => setKey(event.target.value)} required />
          </label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading || !key.trim()}>{loading ? <><LoaderCircle size={17} className="spin" />正在验证…</> : "查看统计"}</button>
          <p className="admin-note">Key 只保存在这个页面的内存里，关闭或刷新页面后需要重新输入。</p>
        </form>
      ) : (
        <div className="admin-dashboard">
          <div className="admin-head">
            <div><span className="doc-eyebrow">Operations</span><h1>运营概况</h1><p className="admin-note">全部为汇总计数，不含房间码、昵称、身份或投票；只统计 24 小时内未过期的房间。每 30 秒自动刷新。</p></div>
            <button type="button" className="doc-back" onClick={() => void load(authorized.current)} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : undefined} />刷新</button>
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}

          <div className="admin-tiles">
            <div className="admin-tile"><small>当前房间</small><strong>{stats.rooms.active}</strong></div>
            <div className="admin-tile"><small>在座玩家</small><strong>{stats.rooms.players}</strong></div>
            <div className="admin-tile"><small>最近 1 小时新建</small><strong>{stats.rooms.createdLastHour}</strong></div>
            <div className="admin-tile"><small>累计局次（含重开）</small><strong>{stats.rooms.roundsPlayed}</strong></div>
          </div>

          <div className="admin-grid">
            <Hourly hourly={stats.hourly} />
            <Bars title="房间所处阶段" rows={Object.entries(stats.phases).map(([phase, count]) => ({ label: PHASES[phase] ?? phase, count })).sort((a, b) => b.count - a.count)} />
            <Bars title="已结束对局的结果" rows={stats.results.map(row => ({ label: `${row.winner === "good" ? "正义" : row.winner === "evil" ? "邪恶" : "未知"} · ${RESULTS[row.reason] ?? row.reason}`, count: row.count })).sort((a, b) => b.count - a.count)} />
            <Bars title="人数" rows={Object.entries(stats.capacities).map(([capacity, count]) => ({ label: `${capacity} 人`, count })).sort((a, b) => parseInt(a.label) - parseInt(b.label))} />
            <Bars title="板子" rows={Object.entries(stats.presets).map(([preset, count]) => ({ label: PRESETS[preset as Preset]?.name ?? preset, count })).sort((a, b) => b.count - a.count)} />
            <section className="admin-card">
              <h2><ShieldAlert size={17} />防护</h2>
              <dl className="admin-facts">
                <div><dt>生效中的限流记录</dt><dd>{stats.limits.activeBuckets}</dd></div>
                <div><dt>因乱猜房间码被拦的网络</dt><dd>{stats.limits.blockedNetworks}</dd></div>
                <div><dt>恢复码错误过多被锁</dt><dd>{stats.limits.blockedRecoveries}</dd></div>
              </dl>
            </section>
            <section className="admin-card">
              <h2><Activity size={17} />服务</h2>
              <dl className="admin-facts">
                <div><dt>版本</dt><dd>{stats.service.version}</dd></div>
                <div><dt>统计查询耗时</dt><dd>{stats.service.databaseMs} ms</dd></div>
                <div><dt>实时同步</dt><dd>{stats.service.liveHub ? "已启用" : "未配置"}</dd></div>
                <div><dt>房主 Key 数</dt><dd>{stats.service.hostKeys}</dd></div>
                <div><dt>管理员 Key 数</dt><dd>{stats.service.adminKeys}</dd></div>
                <div><dt>统计时间</dt><dd>{new Date(stats.generatedAt).toLocaleTimeString("zh-CN", { hour12: false })}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
