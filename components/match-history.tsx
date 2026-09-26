"use client";

import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { factLabel } from "./player-home";

type GameRow = { code: string; round: number; at: number; role: string; side: "good" | "evil"; winner: "good" | "evil"; mvp: number; fact?: string | null };
type Stats = { total: number; won: number; bySide: { good: { played: number; won: number }; evil: { played: number; won: number } }; byRole: { role: string; played: number; won: number }[] };

export function MatchHistory() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  useEffect(() => {
    void fetch("/api/account", { cache: "no-store" }).then(response => response.json() as Promise<{ stats?: Stats | null; games?: GameRow[] }>).then(data => {
      setStats(data.stats ?? null);
      setGames(data.games ?? []);
    });
  }, []);
  const rate = (won: number, played: number) => played ? `${Math.round(won / played * 100)}%` : "—";
  return <section className="account-profile">
    <h1>{t("历史战绩")}</h1>
    {stats && <div className="account-stats history-rates">
      <p><b>{rate(stats.won, stats.total)}</b><span>{t("总胜率")}</span></p>
      <p><b>{rate(stats.bySide.good.won, stats.bySide.good.played)}</b><span>{t("好人胜率")}</span></p>
      <p><b>{rate(stats.bySide.evil.won, stats.bySide.evil.played)}</b><span>{t("坏人胜率")}</span></p>
    </div>}
    {stats && stats.byRole.length > 0 && <ul className="account-roles">{stats.byRole.map(row => <li key={row.role}><span>{t(ROLES[row.role as Role]?.name ?? row.role)}</span><b>{row.won}/{row.played}</b><span>{rate(row.won, row.played)}</span></li>)}</ul>}
    {games.length === 0 && <p>{t("还没有战绩。")}</p>}
    <ul className="history-list">{games.map(game => {
      const name = t(ROLES[game.role as Role]?.name ?? game.role);
      const won = game.side === game.winner;
      const highlight = factLabel(t, game.fact ?? null);
      return <li key={`${game.code}:${game.round}`} className="profile-game-card">
        <strong>{won ? t("{name}胜利", { name }) : t("{name}落败", { name })}</strong>
        {(game.mvp || highlight) && <div className="profile-facts">
          {game.mvp === 1 && <span className="mvp-badge">MVP</span>}
          {highlight && <span>{highlight}</span>}
        </div>}
        <small>{game.code} · {t("第 {n} 局", { n: game.round })}</small>
      </li>;
    })}</ul>
  </section>;
}
