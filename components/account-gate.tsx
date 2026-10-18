"use client";

import { useState, type FormEvent } from "react";
import { Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n/react";

export type SignedAccount = { id: string; name: string; canHost: boolean; title?: string | null; avatar?: string | null };

export function AccountGate({ onLogin, onGuest }: { onLogin: (account: SignedAccount) => void; onGuest: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, name, password }),
      });
      const data = await response.json() as { account?: SignedAccount; error?: string };
      if (!response.ok || !data.account) throw new Error(data.error || t("账号服务暂时不可用。"));
      onLogin(data.account);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("账号服务暂时不可用。"));
    } finally {
      setBusy(false);
    }
  };
  return <main className="app-shell account-gate">
    <section className="gate-card" aria-labelledby="gate-title">
      <span className="gate-emblem" aria-hidden="true"><Crown size={28} strokeWidth={1.5} /></span>
      <p className="gate-kicker">THE ROUND TABLE · AVALON</p>
      <h1 id="gate-title">{t("圆桌")}</h1>
      <p className="gate-lead">{t("登录后战绩会留在账号里。这台手机会保持登录。")}</p>
      <div className="account-mode">
        <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => setMode("login")}>{t("登录")}</button>
        <button type="button" className={mode === "register" ? "active" : ""} aria-pressed={mode === "register"} onClick={() => setMode("register")}>{t("注册")}</button>
      </div>
      <form onSubmit={event => void submit(event)} className="form-stack">
        <label className="field">{t("账号名")}<input autoComplete="username" value={name} onChange={event => setName(event.target.value)} required /></label>
        <label className="field">{t("密码")}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {error && <p className="entry-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? t("请稍候") : mode === "login" ? t("登录") : t("注册")}</button>
      </form>
      {mode === "register" && <p className="action-note">{t("新账号是普通账号，建房时填房主 Key。开通后变成高级账号，就不用再填。")}</p>}
      <div className="gate-divider" aria-hidden="true"><span>{t("或")}</span></div>
      <button type="button" className="secondary-button wide gate-guest" onClick={onGuest}>{t("游客模式")}</button>
      <p className="gate-guest-note">{t("不登录也能建房和入座，战绩只留在这台设备上。")}</p>
    </section>
  </main>;
}
