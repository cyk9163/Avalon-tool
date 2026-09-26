"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/react";
import { AvatarFace } from "./avatar-face";
import { PlayerHome } from "./player-home";

type Friend = { id: string; name: string; avatar: string | null; title: string | null; added?: boolean };

export function FriendsPanel() {
  const { t, ts } = useI18n();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Friend[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => {
    void fetch("/api/friends", { cache: "no-store" }).then(response => response.json() as Promise<{ friends?: Friend[] }>).then(data => setFriends(data.friends ?? []));
  };
  useEffect(() => { load(); }, []);
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
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || t("好友服务暂时不可用。")); return; }
    setResults(current => current?.map(item => item.name === name ? { ...item, added: true } : item) ?? null);
    load();
  };
  const remove = async (id: string) => {
    const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remove", id }) });
    if (response.ok) setFriends(current => current.filter(item => item.id !== id));
  };
  return <section className="friends-panel">
    <h2>{t("好友")}</h2>
    <form className="friend-search" onSubmit={event => void search(event)}>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("搜索好友")} aria-label={t("搜索好友")} maxLength={16} />
      <button type="submit" className="secondary-button">{t("搜索")}</button>
    </form>
    {error && <p className="entry-error" role="alert">{ts(error)}</p>}
    {results && results.length === 0 && <p>{t("没有找到这个账号。")}</p>}
    {results && results.length > 0 && <ul className="friend-list">{results.map(item => <li key={item.id}>
      <button type="button" className="friend-open" onClick={() => setOpenId(item.id)}><AvatarFace id={item.avatar} size={22} /><span><b>{item.name}</b>{item.title ? <small>{t(item.title)}</small> : null}</span></button>
      <button type="button" className="text-button" disabled={item.added} onClick={() => void add(item.name)}>{item.added ? t("已添加") : t("加上")}</button>
    </li>)}</ul>}
    {friends.length === 0 && results === null && <p>{t("还没有好友。输入名字搜索。")}</p>}
    {friends.length > 0 && <ul className="friend-list">{friends.map(item => <li key={item.id}>
      <button type="button" className="friend-open" onClick={() => setOpenId(item.id)}><AvatarFace id={item.avatar} size={22} /><span><b>{item.name}</b>{item.title ? <small>{t(item.title)}</small> : null}</span></button>
      <button type="button" className="text-button" onClick={() => void remove(item.id)}>{t("移除")}</button>
    </li>)}</ul>}
    {openId && <PlayerHome id={openId} onClose={() => setOpenId(null)} />}
  </section>;
}
