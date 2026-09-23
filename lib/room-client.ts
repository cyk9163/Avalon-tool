"use client";

import type { RoomView } from "@/lib/game";
import { msg } from "@/lib/i18n/core";

let sessionBootstrap: Promise<unknown> | null = null;

export function ensureSession() {
  if (!sessionBootstrap) {
    const initialize = () => request("/api/room?session=1");
    sessionBootstrap = (navigator.locks ? navigator.locks.request("avalon:session", initialize) : initialize()).catch(error => { sessionBootstrap = null; throw error; });
  }
  return sessionBootstrap;
}

const INVITE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
let invite: { code: string; token: string } | null = null;

export function rememberInvite(code: string, token: string | null | undefined) {
  if (!token || !INVITE_PATTERN.test(token) || (invite?.code === code && invite.token === token)) return;
  invite = { code, token };
  try { localStorage.setItem("avalon:invite", JSON.stringify(invite)); } catch { /* private mode */ }
}

export function inviteFor(code: string) {
  if (!invite) {
    try {
      const saved = JSON.parse(localStorage.getItem("avalon:invite") || "null") as { code?: string; token?: string } | null;
      if (saved && typeof saved.code === "string" && typeof saved.token === "string" && INVITE_PATTERN.test(saved.token)) invite = { code: saved.code, token: saved.token };
    } catch { /* ignore unreadable storage */ }
  }
  return invite?.code === code ? invite.token : null;
}

export async function request<T = RoomView>(path: string, body?: Record<string, unknown>, roomCode?: string): Promise<T> {
  const token = roomCode ? inviteFor(roomCode) : null;
  const headers: Record<string, string> = { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { "X-Avalon-Invite": token } : {}) };
  const response = await fetch(path, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error(msg("服务暂时不可用，请稍后重试。")); }
  if (!response.ok) throw Object.assign(new Error((result as { error?: string })?.error || msg("操作未完成，请重试。")), { status: response.status });
  return result as T;
}
