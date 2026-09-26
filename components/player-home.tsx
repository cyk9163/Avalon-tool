"use client";

import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { AvatarFace } from "./avatar-face";

type Profile = {
  name: string;
  title: string | null;
  avatar: string | null;
  achievements: { done: number; total: number };
  stats: { total: number; won: number; bySide: { good: { played: number; won: number }; evil: { played: number; won: number } } };
  games: { role: string; won: boolean; mvp: boolean; fact: string | null }[];
};

function factLabel(t: (zh: string) => string, fact: string | null): string | null {
  if (fact === "hit") return t("刺中梅林");
  if (fact === "miss") return t("空刀一场");
  if (fact === "lived") return t("梅林未死");
  if (fact === "died") return t("梅林被刺");
  if (fact === "b2") return t("上了两车");
  if (fact === "b3") return t("上了三车");
  if (fact === "paced") return t("带了节奏");
  if (fact === "hidden") return t("出红再藏");
  if (fact === "sided") return t("站对了边");
  if (fact === "red") return t("出了红牌");
  if (fact === "read") return t("票跟对了");
  if (fact === "boardwin") return t("上车仍胜");
  if (fact === "held") return t("后期收手");
  if (fact === "outwin") return t("揭牌仍胜");
  return null;
}

export function PlayerHome({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, ts } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState({ id, index: 0 });
  const index = cursor.id === id ? cursor.index : 0;
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/profile?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
      const data = await response.json() as Profile & { error?: string };
      if (cancelled) return;
      if (!response.ok) { setError(data.error || t("主页暂时打不开。")); return; }
      setProfile(data);
    }).catch(() => { if (!cancelled) setError(t("主页暂时打不开。")); });
    return () => { cancelled = true; };
  }, [id, t]);
  const rate = (won: number, played: number) => played ? `${Math.round(won / played * 100)}%` : "—";
  const game = profile?.games[index];
  const roleName = game ? t(ROLES[game.role as Role]?.name ?? game.role) : "";
  const highlight = game ? factLabel(t, game.fact) : null;
  const progress = profile ? Math.round(profile.achievements.done / Math.max(profile.achievements.total, 1) * 100) : 0;
  return <div className="player-home-layer" onClick={onClose}>
    <section className="player-home" role="dialog" aria-label={t("个人主页")} onClick={event => event.stopPropagation()}>
      <header className="account-profile-head">
        <div className="player-home-id">
          <AvatarFace id={profile?.avatar} size={28} />
          <div>
            <p className="worn-title">{profile?.title ? t(profile.title) : t("还没有称号")}</p>
            <h2>{profile?.name ?? t("个人主页")}</h2>
          </div>
        </div>
        <button type="button" className="text-button" onClick={onClose}>{t("关闭")}</button>
      </header>
      {error && <p className="entry-error" role="alert">{ts(error)}</p>}
      {!profile && !error && <p>{t("正在打开主页…")}</p>}
      {profile && <>
        <div className="achievement-progress">
          <div><span>{t("成就")}</span><b>{t("{done} / {total}", { done: profile.achievements.done, total: profile.achievements.total })}</b></div>
          <div className="achievement-bar" role="progressbar" aria-valuenow={profile.achievements.done} aria-valuemin={0} aria-valuemax={profile.achievements.total} aria-label={t("成就")}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="account-stats">
          <p><b>{rate(profile.stats.won, profile.stats.total)}</b><span>{t("总胜率")}</span></p>
          <p><b>{rate(profile.stats.bySide.good.won, profile.stats.bySide.good.played)}</b><span>{t("好人胜率")}</span></p>
          <p><b>{rate(profile.stats.bySide.evil.won, profile.stats.bySide.evil.played)}</b><span>{t("坏人胜率")}</span></p>
        </div>
        <h3>{t("对局战绩")}</h3>
        {profile.games.length === 0 && <p>{t("还没有战绩。")}</p>}
        {game && <div className="profile-game">
          <button type="button" className="text-button" disabled={index === 0} onClick={() => setCursor({ id, index: index - 1 })}>{t("上一场")}</button>
          <article className="profile-game-card">
            <strong>{game.won ? t("{name}胜利", { name: roleName }) : t("{name}落败", { name: roleName })}</strong>
            {(game.mvp || highlight) && <div className="profile-facts">
              {game.mvp && <span className="mvp-badge">MVP</span>}
              {highlight && <span>{highlight}</span>}
            </div>}
            <small>{t("第 {n} 场，共 {m} 场", { n: index + 1, m: profile.games.length })}</small>
          </article>
          <button type="button" className="text-button" disabled={index === profile.games.length - 1} onClick={() => setCursor({ id, index: index + 1 })}>{t("下一场")}</button>
        </div>}
      </>}
    </section>
  </div>;
}
