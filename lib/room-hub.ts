// One Durable Object per room code: a fan-out hub for live change signals.
// It stores nothing and never sees room state. The Worker authorizes each
// handshake (lib/live-gateway.ts) before forwarding it here, and the room API
// calls notify() after every committed change (lib/room-signal.ts).
//
// Uses the WebSocket Hibernation API: between signals the object is evicted
// from memory while sockets stay open, which keeps it inside the free plan's
// duration allowance. Keep-alive pings are answered by the runtime without
// waking the object.
import { DurableObject } from "cloudflare:workers";
import { LIVE_PING, LIVE_PONG, MAX_LIVE_SOCKETS, isWebSocketUpgrade, liveSignal } from "./live";

export class RoomHub extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(LIVE_PING, LIVE_PONG));
  }

  async fetch(request: Request): Promise<Response> {
    if (!isWebSocketUpgrade(request)) return new Response(null, { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_LIVE_SOCKETS) {
      return new Response(JSON.stringify({ error: "这个房间的实时连接已满，页面会改为定时同步。" }), { status: 429, headers: { "Content-Type": "application/json; charset=utf-8" } });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Broadcasts the new room version; returns how many sockets it reached. */
  async notify(version: number): Promise<number> {
    const message = liveSignal(version);
    let delivered = 0;
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
        delivered++;
      } catch {
        // A socket that is already closing is cleaned up by the runtime.
      }
    }
    return delivered;
  }

  // Clients only ever send keep-alive pings, which the auto-response handles.
  async webSocketMessage(socket: WebSocket) {
    socket.close(1003, "unsupported");
  }

  async webSocketClose(socket: WebSocket, code: number) {
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code, "closing");
    } catch {
      // Already closed by the runtime's automatic close reply.
    }
  }

  async webSocketError(socket: WebSocket) {
    try {
      socket.close(1011, "error");
    } catch {
      // Nothing left to clean up.
    }
  }
}
