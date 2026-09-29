"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/react";
import { PlayerHome } from "./player-home";

type Friend = { id: string; name: string; avatar: string | null; title: string | null; online?: boolean; added?: boolean; pending?: boolean };
export type RoomInvite = { id: string; code: string; invite: string | null; from: string };

export function FriendsPanel() {
  const { t, ts } = useI18n();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Friend[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => {
    void fetch("/api/friends", { cache: "no-store" }).then(response => response.json() as Promise<{ friends?: Friend[]; requests?: Friend[] }>).then(data => {
      setFriends(data.friends ?? []);
      setRequests(data.requests ?? []);
    });
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 12000);
    return () => window.clearInterval(timer);
  }, []);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "search", name: query }) });
    const data = await response.json() as { results?: Friend[]; error?: string };
    if (!response.ok) { setError(data.error || t("好友服务暂时不可用。")); setResults(null); return; }
    setResults(data.results ?? []);
  };
  const add = async (name: string) => {
    setError("");
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", name }) });
    const data = await response.json() as { status?: string; error?: string };
    if (!response.ok) { setError(data.error || t("好友服务暂时不可用。")); return; }
    setResults(current => current?.map(item => item.name === name ? { ...item, added: data.status === "added", pending: data.status === "pending" } : item) ?? null);
    load();
  };
  const answer = async (id: string, action: "accept" | "reject") => {
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id }) });
    if (response.ok) load();
  };
  const remove = async (id: string) => {
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remove", id }) });
    if (response.ok) setFriends(current => current.filter(item => item.id !== id));
  };
  const label = (item: Friend) => item.added ? t("已添加") : item.pending ? t("已发送") : t("添加好友");
  return <section className="friends-panel">
    <h2>{t("好友")}</h2>
    {requests.length > 0 && <div className="friend-requests">
      <h3>{t("新朋友")}</h3>
      <ul className="friend-list">{requests.map(item => <li key={item.id}>
        <span><b>{item.name}</b>{item.title ? <small>{t(item.title)}</small> : null}</span>
        <span className="friend-actions">
          <button type="button" className="secondary-button" onClick={() => void answer(item.id, "accept")}>{t("同意")}</button>
          <button type="button" className="text-button" onClick={() => void answer(item.id, "reject")}>{t("拒绝")}</button>
        </span>
      </li>)}</ul>
    </div>}
    <form className="friend-search" onSubmit={event => void search(event)}>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("搜索好友")} aria-label={t("搜索好友")} maxLength={16} />
      <button type="submit" className="secondary-button">{t("搜索")}</button>
    </form>
    {error && <p className="entry-error" role="alert">{ts(error)}</p>}
    {results && results.length === 0 && <p>{t("没有找到这个账号。")}</p>}
    {results && results.length > 0 && <ul className="friend-list">{results.map(item => <li key={item.id}>
      <button type="button" className="friend-open" onClick={() => setOpenId(item.id)}><span><b>{item.name}</b>{item.title ? <small>{t(item.title)}</small> : null}</span></button>
      <button type="button" className="text-button" disabled={item.added || item.pending} onClick={() => void add(item.name)}>{label(item)}</button>
    </li>)}</ul>}
    {friends.length === 0 && results === null && requests.length === 0 && <p>{t("还没有好友。输入名字搜索。")}</p>}
    {friends.length > 0 && <ul className="friend-list">{friends.map(item => <li key={item.id}>
      <button type="button" className="friend-open" onClick={() => setOpenId(item.id)}><span><b>{item.name}</b>{item.title ? <small>{t(item.title)}</small> : null}<small className={item.online ? "friend-status is-on" : "friend-status"}>{item.online ? t("在线") : t("不在线")}</small></span></button>
      <button type="button" className="text-button" onClick={() => void remove(item.id)}>{t("移除")}</button>
    </li>)}</ul>}
    {openId && <PlayerHome id={openId} onClose={() => setOpenId(null)} />}
  </section>;
}

export function FriendRoster({ code, picked, onToggle }: { code?: string; picked?: string[]; onToggle?: (id: string) => void }) {
  const { t, ts } = useI18n();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/friends", { cache: "no-store" }).then(response => response.json() as Promise<{ friends?: Friend[] }>).then(data => {
        if (!cancelled) setFriends(data.friends ?? []);
      });
    };
    load();
    const timer = window.setInterval(load, 12000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  const invite = async (id: string) => {
    if (!code) return;
    setError("");
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "invite", id, code }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || t("好友服务暂时不可用。")); return; }
    setSent(current => current.includes(id) ? current : [...current, id]);
  };
  if (friends.length === 0) return null;
  return <details className="friend-roster">
    <summary>{t("邀请好友")}</summary>
    {error && <p className="entry-error" role="alert">{ts(error)}</p>}
    <ul className="friend-list">{friends.map(item => <li key={item.id}>
      <span><b>{item.name}</b><small className={item.online ? "friend-status is-on" : "friend-status"}>{item.online ? t("在线") : t("不在线")}</small></span>
      {code ? <button type="button" className="text-button" disabled={sent.includes(item.id)} onClick={() => void invite(item.id)}>{sent.includes(item.id) ? t("已发送") : t("邀请")}</button>
        : <button type="button" className="text-button" aria-pressed={picked?.includes(item.id)} onClick={() => onToggle?.(item.id)}>{picked?.includes(item.id) ? t("已选") : t("邀请")}</button>}
    </li>)}</ul>
    {!code && <p className="action-note">{t("建立房间后，选中的好友会收到邀请。")}</p>}
  </details>;
}

export function IncomingInvite({ here, name, onJoin }: { here?: string; name: string; onJoin: (code: string, invite: string | null, nickname: string) => void }) {
  const { t } = useI18n();
  const [invite, setInvite] = useState<RoomInvite | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/friends", { cache: "no-store" }).then(response => response.json() as Promise<{ invite?: RoomInvite | null }>).then(data => {
        if (!cancelled) setInvite(data.invite && data.invite.code !== here ? data.invite : null);
      }).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [here]);
  if (!invite) return null;
  const decline = () => {
    const id = invite.id;
    setInvite(null);
    void fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decline-invite", id }) });
  };
  return <div className="invite-layer">
    <section className="invite-card" role="dialog" aria-label={t("房间邀请")}>
      <h2>{t("{name} 邀请你加入房间", { name: invite.from })}</h2>
      <p>{invite.code}</p>
      <div className="invite-actions">
        <button type="button" className="primary-button" onClick={() => { const next = invite; setInvite(null); void fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decline-invite", id: next.id }) }); onJoin(next.code, next.invite, name); }}>{t("进入")}</button>
        <button type="button" className="secondary-button" onClick={decline}>{t("拒绝")}</button>
      </div>
    </section>
  </div>;
}
