"use client";

import { useState } from "react";
import { PRESETS, ROLES } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { usePersonalRecord, type PersonalGame } from "@/lib/personal-record";
import { replayDate } from "@/lib/replay";

function percent(won: number, played: number): string {
  if (!played) return "—";
  return `${Math.round(won / played * 100)}%`;
}

/** This device's own win rates. The numbers never leave the browser. */
export function PersonalRecord() {
  const { t } = useI18n();
  const { stats, clear } = usePersonalRecord();
  const [confirming, setConfirming] = useState(false);
  if (stats.total === 0) {
    return <p>{t("还没有战绩。打完一局，结局会记在这台设备上。")}</p>;
  }
  return <div className="personal-record">
    <div className="record-stats">
      <p className="record-stat"><span>{t("总胜率")}</span><strong>{percent(stats.won, stats.total)}</strong><small>{t("{won} 胜 / {played} 局", { won: stats.won, played: stats.total })}</small></p>
      <p className="record-stat"><span>{t("正义阵营")}</span><strong>{percent(stats.bySide.good.won, stats.bySide.good.played)}</strong><small>{t("{won} 胜 / {played} 局", { won: stats.bySide.good.won, played: stats.bySide.good.played })}</small></p>
      <p className="record-stat"><span>{t("邪恶阵营")}</span><strong>{percent(stats.bySide.evil.won, stats.bySide.evil.played)}</strong><small>{t("{won} 胜 / {played} 局", { won: stats.bySide.evil.won, played: stats.bySide.evil.played })}</small></p>
    </div>
    <h2>{t("各角色胜率")}</h2>
    <ul className="record-roles">
      {stats.byRole.map(row => <li key={row.role}><span>{t(ROLES[row.role].name)}</span><b>{percent(row.won, row.played)}</b><small>{t("{won} 胜 / {played} 局", { won: row.won, played: row.played })}</small></li>)}
    </ul>
    <p>{t("当梅林被刺中 {hit} 次（共当了 {played} 局梅林）。", { hit: stats.merlinHit, played: stats.merlinPlayed })}</p>
    <h2>{t("最近 10 局")}</h2>
    <div className="doc-table-wrap" role="region" aria-label={t("最近 10 局")} tabIndex={0}>
      <table className="doc-table">
        <thead><tr><th scope="col">{t("日期")}</th><th scope="col">{t("人数")}</th><th scope="col">{t("板子")}</th><th scope="col">{t("角色")}</th><th scope="col">{t("胜负")}</th></tr></thead>
        <tbody>
          {stats.recent.map(game => <tr key={`${game.code}:${game.round}`}><GameRow game={game} /></tr>)}
        </tbody>
      </table>
    </div>
    {confirming
      ? <div className="record-clear"><p>{t("这台设备上的战绩会被删掉，而且无法恢复。")}</p><button type="button" className="secondary-button" onClick={() => { clear(); setConfirming(false); }}>{t("确认清除")}</button><button type="button" className="text-button" onClick={() => setConfirming(false)}>{t("再想一下")}</button></div>
      : <button type="button" className="text-button record-clear-button" onClick={() => setConfirming(true)}>{t("清除本机战绩")}</button>}
  </div>;
}

function GameRow({ game }: { game: PersonalGame }) {
  const { t } = useI18n();
  const board = game.ladyOfLake ? t("{board} + 湖中仙女", { board: t(PRESETS[game.preset].name) }) : t(PRESETS[game.preset].name);
  return <>
    <td>{replayDate(new Date(game.at))}</td>
    <td>{t("{n} 人", { n: game.capacity })}</td>
    <td>{board}</td>
    <td>{t(ROLES[game.role].name)}{game.role === "merlin" && game.assassinHit ? t("（被刺中）") : ""}</td>
    <td>{game.won ? t("胜") : t("负")}</td>
  </>;
}
