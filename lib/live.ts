// Live room signals (v0.9). A per-room Durable Object pushes "room changed to
// version N" over WebSocket; clients then re-read their own projection through
// the authorized GET /api/room. Signals never carry names, roles, votes or
// quest cards, so the WebSocket adds no new way to learn hidden information.
// This module is dependency-free so both the Worker and unit tests can use it.

export const LIVE_PATH = "/api/room/live";
export const LIVE_PING = "ping";
export const LIVE_PONG = "pong";
/** Upper bound on sockets per room: 10 seats, several tabs each, and spectators. */
export const MAX_LIVE_SOCKETS = 48;
/** Keep-alive interval; mobile carriers drop idle connections after ~30-60 s. */
export const LIVE_PING_MS = 25_000;
/** Safety-net polling while the live channel is open (3 s without it). */
export const LIVE_FALLBACK_POLL_MS = 30_000;

export type LiveSignal = { type: "changed"; version: number };

export function liveSignal(version: number): string {
  return JSON.stringify({ type: "changed", version } satisfies LiveSignal);
}

/** Returns the announced room version, or null for anything that is not a valid signal. */
export function parseLiveSignal(data: unknown): number | null {
  if (typeof data !== "string" || data.length > 64) return null;
  try {
    const parsed = JSON.parse(data) as Partial<LiveSignal>;
    return parsed?.type === "changed" && Number.isSafeInteger(parsed.version) && (parsed.version as number) > 0 ? parsed.version as number : null;
  } catch {
    return null;
  }
}

/**
 * Browsers always send Origin on WebSocket handshakes and cannot be stopped by
 * CORS, so the handshake itself must prove it came from the app's own page.
 */
export function liveOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("upgrade")?.toLowerCase() === "websocket";
}
