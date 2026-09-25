"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { ROLES, type Role } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import type { SignedAccount } from "./account-gate";

type GameRow = { code: string; round: number; at: number; capacity: number; preset: string; role: string; side: "good" | "evil"; winner: "good" | "evil"; mvp: number };
type Stats = { total: number; won: number; mvp: number; bySide: { good: { played: number; won: number }; evil: { played: number; won: number } }; byRole: { role: string; played: number; won: number }[] };

export function AccountProfile({ account, onLogout, onTitle }: { account: SignedAccount; onLogout: () => void; onTitle: (title: string) => void }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/account", { cache: "no-store" }).then(response => response.json() as Promise<{ stats?: Stats | null; games?: GameRow[]; achievements?: string[] }>).then(data => {
      setStats(data.stats ?? null);
      setGames(data.games ?? []);
      setUnlocked(data.achievements ?? []);
    });
  }, []);
  const wear = (id: string) => {
    void fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "title", title: id }) }).then(response => {
      if (response.ok) onTitle(id);
    });
  };
  const rate = (won: number, played: number) => played ? `${Math.round(won / played * 100)}%` : "—";
  return <section className="account-profile">
    <header className="account-profile-head">
      <div><p className="worn-title">{account.title ? t(ACHIEVEMENTS.find(item => item.id === account.title)?.name ?? account.title) : t("还没有称号")}</p><h1>{account.name}</h1><p>{account.canHost ? t("可以开房") : t("还不能开房")}</p></div>
      <button type="button" className="text-button" onClick={onLogout}>{t("退出登录")}</button>
    </header>
    {stats && <div className="account-stats">
      <p><b>{stats.total}</b><span>{t("局")}</span></p>
      <p><b>{rate(stats.won, stats.total)}</b><span>{t("胜率")}</span></p>
      <p><b>{stats.mvp}</b><span>{t("次 MVP")}</span></p>
      <p><b>{rate(stats.bySide.good.won, stats.bySide.good.played)}</b><span>{t("好人")}</span></p>
      <p><b>{rate(stats.bySide.evil.won, stats.bySide.evil.played)}</b><span>{t("坏人")}</span></p>
    </div>}
    {stats && <ul className="account-roles">{stats.byRole.map(row => <li key={row.role}><span>{t(ROLES[row.role as Role]?.name ?? row.role)}</span><b>{row.won}/{row.played}</b></li>)}</ul>}
    <h2>{t("称号")}</h2>
    {unlocked.length === 0 && <p>{t("打完一局，高光和搞笑瞬间会变成可以挂上的称号。")}</p>}
    <ul className="account-titles">{ACHIEVEMENTS.map(item => {
      const owned = unlocked.includes(item.id);
      return <li key={item.id}><button type="button" disabled={!owned} className={account.title === item.id ? "selected" : ""} onClick={() => wear(item.id)}><b>{t(item.name)}</b><span>{owned ? (account.title === item.id ? t("已挂上") : t("挂上")) : t(item.hint)}</span></button></li>;
    })}</ul>
    <h2>{t("对局记录")}</h2>
    <ul className="account-games">{games.map(game => <li key={`${game.code}:${game.round}`}><span>{game.code} · {t("第 {n} 局", { n: game.round })}</span><span>{t(ROLES[game.role as Role]?.name ?? game.role)} · {game.side === game.winner ? t("胜") : t("负")}{game.mvp ? ` · MVP` : ""}</span></li>)}</ul>
  </section>;
}
