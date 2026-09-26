"use client";

import { useEffect, useState } from "react";
import { AVATAR_IDS, AvatarFace, avatarName } from "@/components/avatar-face";
import { ACHIEVEMENTS, achievementById, achievementProgress } from "@/lib/achievements";
import { useI18n } from "@/lib/i18n/react";
import type { SignedAccount } from "./account-gate";
import { FriendsPanel } from "./friends";

export function AccountProfile({ account, onLogout, onTitle, onAvatar }: { account: SignedAccount; onLogout: () => void; onTitle: (title: string) => void; onAvatar: (avatar: string) => void }) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/account", { cache: "no-store" }).then(response => response.json() as Promise<{ achievements?: string[] }>).then(data => {
      setUnlocked(data.achievements ?? []);
    });
  }, []);
  const pickAvatar = (id: string) => {
    void fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "avatar", avatar: id }) }).then(response => {
      if (response.ok) onAvatar(id);
    });
  };
  const wear = (id: string) => {
    void fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "title", title: id }) }).then(response => {
      if (response.ok) onTitle(id);
    });
  };
  const worn = account.title ? achievementById(account.title) : undefined;
  const owned = (id: string) => unlocked.includes(id);
  const progress = achievementProgress(unlocked);
  const percent = Math.round(progress.done / Math.max(progress.total, 1) * 100);
  const ranks = unlocked.map(id => achievementById(id)).filter(item => item?.mark);
  return <section className="account-profile">
    <header className="account-profile-head">
      <div className="player-home-id"><AvatarFace id={account.avatar} size={36} /><div><p className={`worn-title${worn?.mark ? ` is-${worn.mark}` : ""}`}>{worn ? t(worn.name) : t("还没有称号")}</p><h1>{account.name}</h1><p>{account.canHost ? t("高级账号") : t("普通账号")}</p></div></div>
      <button type="button" className="text-button" onClick={onLogout}>{t("退出登录")}</button>
    </header>
    <FriendsPanel />
    <h2>{t("头像")}</h2>
    <div className="avatar-picker">{AVATAR_IDS.map(id => <button key={id} type="button" className={account.avatar === id ? "selected" : ""} aria-label={avatarName(t, id)} aria-pressed={account.avatar === id} onClick={() => pickAvatar(id)}><AvatarFace id={id} size={22} /><span>{avatarName(t, id)}</span></button>)}</div>
    <div className="achievement-progress">
      <div><span>{t("成就")}</span><b>{t("{done} / {total}", { done: progress.done, total: progress.total })}</b></div>
      <div className="achievement-bar" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label={t("成就")}>
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
    <h2>{t("称号")}</h2>
    {unlocked.length === 0 && <p>{t("打完一局，高光和搞笑瞬间会变成可以挂上的称号。")}</p>}
    <ul className="account-titles">{ranks.map(item => item && <li key={item.id}><button type="button" className={account.title === item.id ? "selected" : ""} onClick={() => wear(item.id)}><b>{t(item.name)}</b><span>{account.title === item.id ? t("已挂上") : t("挂上")}</span></button></li>)}{ACHIEVEMENTS.map(item => {
      const have = owned(item.id);
      return <li key={item.id}><button type="button" disabled={!have} className={account.title === item.id ? "selected" : ""} onClick={() => wear(item.id)}><b>{t(item.name)}</b><span>{have ? (account.title === item.id ? t("已挂上") : t("挂上")) : t(item.hint)}</span></button></li>;
    })}</ul>
  </section>;
}
