"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { RoomView } from "@/lib/game";
import { useRoomLive } from "@/lib/use-room-live";
import { LIVE_FALLBACK_POLL_MS } from "@/lib/live";

type Load = (target: string) => Promise<RoomView>;

/** The room's live channel and its slow polling fallback. Same timing as before the split. */
export function useRoomSync(
  room: RoomView | null,
  goneCode: string,
  currentCode: MutableRefObject<string>,
  latest: MutableRefObject<RoomView | null>,
  load: Load,
  setError: (value: string) => void,
  setConnected: (value: boolean) => void,
  setGoneCode: (code: string) => void,
  setReveal: (value: boolean) => void,
) {
  const refreshing = useRef(false);
  const refreshAgain = useRef(false);
  const onLiveSignal = (version: number | null) => {
    const target = currentCode.current;
    if (!target) return;
    if (version !== null && latest.current?.code === target && latest.current.version >= version) return;
    if (refreshing.current) { refreshAgain.current = true; return; }
    refreshing.current = true;
    void (async () => {
      do {
        refreshAgain.current = false;
        try { await load(target); } catch { /* the polling loop reports connection problems */ }
      } while (refreshAgain.current && currentCode.current === target);
      refreshing.current = false;
    })();
  };
  const live = useRoomLive(room?.code && room.code !== goneCode ? room.code : null, onLiveSignal);
  useEffect(() => {
    if (!room?.code) return;
    let cancelled = false, inFlight = false, timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      if (!document.hidden && navigator.onLine !== false) {
        try { await load(room.code); failures = 0; }
        catch (error) {
          if ([404, 410].includes((error as { status?: number }).status ?? 0)) {
            if (!cancelled) { setError((error as Error).message); setConnected(true); setGoneCode(room.code); }
            inFlight = false;
            return;
          }
          if (!cancelled) { setConnected(false); failures++; }
        }
      }
      inFlight = false;
      if (!cancelled) timer = setTimeout(poll, live && !failures ? LIVE_FALLBACK_POLL_MS : Math.min(3000 * (failures + 1), 15000));
    };
    timer = setTimeout(poll, live ? LIVE_FALLBACK_POLL_MS : 3000);
    const wake = () => { setReveal(false); if (!document.hidden) { clearTimeout(timer); void poll(); } };
    const offline = () => { setConnected(false); setReveal(false); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    window.addEventListener("pageshow", wake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pageshow", wake);
    };
  }, [live, load, room?.code, setConnected, setError, setGoneCode, setReveal]);
  return live;
}
