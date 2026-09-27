"use client";

import { useEffect, useState } from "react";
import { achievementById, achievementProgress, liveAchievements, type Achievement } from "@/lib/achievements";
import { useI18n } from "@/lib/i18n/react";
import type { SignedAccount } from "./account-gate";
import { FriendsPanel } from "./friends";

export function AccountProfile({ account, onLogout, onTitle }: { account: SignedAccount; onLogout: () => void; onTitle: (title: string) => void }) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [showMissing, setShowMissing] = useState(false);
  useEffect(() => {
    void fetch("/api/account", { cache: "no-store" }).then(response => response.json() as Promise<{ achievements?: string[] }>).then(data => {
      setUnlocked(data.achievements ?? []);
    });
  }, []);
  const wear = (id: string) => {
    void fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "title", title: id }) }).then(response => {
      if (response.ok) onTitle(id);
    });
  };
  const worn = account.title ? achievementById(account.title) : undefined;
  const progress = achievementProgress(unlocked);
  const percent = Math.round(progress.done / Math.max(progress.total, 1) * 100);
  const owned = unlocked.map(id => achievementById(id)).filter((item): item is Achievement => Boolean(item));
  const missing = liveAchievements().filter(item => !unlocked.includes(item.id));
  const shown = showMissing ? missing : owned;
  return <section className="account-profile">
    <header className="account-profile-head">
      <div><p className={`worn-title${worn?.mark ? ` is-${worn.mark}` : ""}`}>{worn ? t(worn.name) : t("还没有称号")}</p><h1>{account.name}</h1><p>{account.canHost ? t("高级账号") : t("普通账号")}</p></div>
      <button type="button" className="text-button" onClick={onLogout}>{t("退出登录")}</button>
    </header>
    <FriendsPanel />
    <div className="achievement-progress">
      <div><span>{t("成就")}</span><b>{t("{done} / {total}", { done: progress.done, total: progress.total })}</b></div>
      <div className="achievement-bar" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label={t("成就")}>
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
    <div className="achievement-switch">
      <button type="button" className="secondary-button" onClick={() => setShowMissing(value => !value)}>{showMissing ? t("显示已点亮") : t("显示未拥有")}</button>
    </div>
    {shown.length === 0 && <p>{showMissing ? t("已经全部点亮。") : t("还没有点亮的成就。")}</p>}
    <ul className="account-titles">{shown.map(item => <li key={item.id}><button type="button" disabled={showMissing} className={account.title === item.id ? "selected" : ""} onClick={() => wear(item.id)}><b>{t(item.name)}</b><span>{showMissing ? t(item.hint) : (account.title === item.id ? t("已挂上") : t("挂上"))}</span></button></li>)}</ul>
  </section>;
}
