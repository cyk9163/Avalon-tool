"use client";

import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { AvatarFace } from "./avatar-face";

type Profile = {
  name: string;
  title: string | null;
  avatar: string | null;
  titles: string[];
  stats: { total: number; won: number; mvp: number; byRole: { role: string; played: number; won: number }[] };
};

export function PlayerHome({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, ts } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
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
      {profile && <div className="account-stats">
        <p><b>{profile.stats.total}</b><span>{t("局")}</span></p>
        <p><b>{rate(profile.stats.won, profile.stats.total)}</b><span>{t("胜率")}</span></p>
        <p><b>{profile.stats.mvp}</b><span>{t("次 MVP")}</span></p>
      </div>}
      {profile && profile.stats.byRole.length > 0 && <ul className="account-roles">{profile.stats.byRole.map(row => <li key={row.role}><span>{t(ROLES[row.role as Role]?.name ?? row.role)}</span><b>{row.won}/{row.played}</b><span>{rate(row.won, row.played)}</span></li>)}</ul>}
      {profile && profile.stats.total === 0 && <p>{t("还没有战绩。")}</p>}
      {profile && profile.titles.length > 0 && <><h3>{t("称号")}</h3><ul className="account-titles">{profile.titles.map(name => <li key={name}><span>{t(name)}</span></li>)}</ul></>}
    </section>
  </div>;
}
