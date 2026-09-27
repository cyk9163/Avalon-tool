"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ReplayTimeline } from "@/components/replay-timeline";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { replayGame, type PublicReplay } from "@/lib/saved-replay";

export function GameReplay({ code, round, onClose }: { code: string; round: number; onClose: () => void }) {
  const { t, ts } = useI18n();
  const [replay, setReplay] = useState<PublicReplay | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/replay?code=${encodeURIComponent(code)}&round=${round}`, { cache: "no-store" }).then(async response => {
      const data = await response.json() as PublicReplay & { error?: string };
      if (cancelled) return;
      if (!response.ok) { setError(data.error || t("复盘暂时打不开。")); return; }
      setReplay(data);
    }).catch(() => { if (!cancelled) setError(t("复盘暂时打不开。")); });
    return () => { cancelled = true; };
  }, [code, round, t]);
  const room = replay ? {
    capacity: replay.capacity,
    players: replay.players.map(player => ({ id: String(player.seat), name: player.name, seat: player.seat, ready: true, confirmed: true })),
    meId: String(replay.meSeat),
    phase: "finished" as const,
    roles: replay.players.map(player => player.role),
    game: replayGame(replay),
  } as RoomView : null;
  return createPortal(<div className="player-home-layer game-replay-layer">
    <section className="player-home" role="dialog" aria-label={t("复盘")}>
      <div className="player-home-body">
        <header className="account-profile-head">
          <h2>{t("复盘")}</h2>
          <button type="button" className="text-button" onClick={onClose}>{t("关闭")}</button>
        </header>
        {error && <p className="entry-error" role="alert">{ts(error)}</p>}
        {!replay && !error && <p>{t("正在打开复盘…")}</p>}
        {room?.game && <ReplayTimeline room={room} />}
      </div>
    </section>
  </div>, document.body);
}
