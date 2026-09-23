"use client";

import { useEffect, useRef, useState } from "react";
import { LIVE_PATH, LIVE_PING, LIVE_PING_MS, parseLiveSignal } from "./live";

/**
 * Keeps a WebSocket to the room's live hub while the page is visible and
 * online. `onSignal(version)` fires for every announced change, and with
 * `null` whenever a connection (re)opens so the caller can catch up on
 * anything missed. Returns whether the live channel is currently open; the
 * caller keeps polling either way, just less often while it is.
 */
export function useRoomLive(code: string | null, onSignal: (version: number | null) => void): boolean {
  const [live, setLive] = useState(false);
  const handler = useRef(onSignal);
  useEffect(() => { handler.current = onSignal; }, [onSignal]);

  useEffect(() => {
    if (!code || typeof WebSocket === "undefined") return;
    let socket: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined, ping: ReturnType<typeof setInterval> | undefined;
    let failures = 0, stopped = false;

    const close = () => {
      clearInterval(ping); clearTimeout(retry);
      if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; try { socket.close(1000); } catch { /* already closed */ } }
      socket = null; setLive(false);
    };
    const connect = () => {
      clearTimeout(retry);
      if (stopped || socket || document.hidden || navigator.onLine === false) return;
      const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${LIVE_PATH}?code=${encodeURIComponent(code)}`;
      let current: WebSocket;
      try { current = new WebSocket(url); } catch { schedule(); return; }
      socket = current;
      current.onopen = () => {
        failures = 0; setLive(true); handler.current(null);
        ping = setInterval(() => { if (current.readyState === WebSocket.OPEN) current.send(LIVE_PING); }, LIVE_PING_MS);
      };
      current.onmessage = event => {
        const version = parseLiveSignal(event.data);
        if (version !== null) handler.current(version);
      };
      current.onclose = () => {
        clearInterval(ping);
        if (socket === current) socket = null;
        setLive(false); failures++; schedule();
      };
    };
    // Rejected handshakes (expired room, full room, rate limit) look like a
    // plain close, so back off up to a minute; polling covers the gap.
    const schedule = () => {
      clearTimeout(retry);
      if (!stopped) retry = setTimeout(connect, Math.min(1000 * 2 ** Math.min(failures, 6), 60_000));
    };
    // Mobile browsers freeze background sockets; close cleanly and reconnect
    // on return instead of trusting a connection that may be dead.
    const onVisibility = () => { if (document.hidden) close(); else { failures = 0; connect(); } };
    const onOnline = () => { failures = 0; connect(); };
    const onOffline = () => close();

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stopped = true; close();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [code]);

  return live;
}
