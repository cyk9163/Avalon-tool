// Browser push subscriptions (v1.13). Stored beside the room, not inside it:
// the room code is only a hash, and the notice never names a role or a player.
import { env } from "cloudflare:workers";
import { GameError, type Room } from "./game.ts";
import { log } from "./log.ts";
import { hash } from "./request-context.ts";
import { requirePushMember, validatePushSubscription, type PushSubscriptionInput } from "./push-subscription.ts";
import { newlyOnTurn, pushNotice, turnMap } from "./turn.ts";
import { sendWebPush } from "./web-push.ts";

export { requirePushMember, validatePushSubscription };

function database() {
  if (!env.DB) throw new GameError("房间服务暂时不可用，请稍后再试。", 503);
  return env.DB;
}

export async function savePushSubscription(room: Room, playerId: string, subscription: PushSubscriptionInput) {
  const roomHash = await hash(room.code);
  const id = await hash(`${roomHash}:${playerId}`);
  const now = Date.now();
  await database().prepare(`INSERT INTO push_subscriptions (id, room_hash, player_id, endpoint, p256dh, auth, lang, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, created_at = excluded.created_at, expires_at = excluded.expires_at`)
    .bind(id, roomHash, playerId, subscription.endpoint, subscription.p256dh, subscription.auth, subscription.lang, now, room.expiresAt)
    .run();
}

export async function removePushSubscription(room: Room, playerId: string) {
  const id = await hash(`${await hash(room.code)}:${playerId}`);
  await database().prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(id).run();
}

type PushRow = { id: string; player_id: string; endpoint: string; p256dh: string; auth: string; lang: string };

/** After a successful room change: one notice per player whose prompt just appeared or changed. */
export async function notifyNewTurns(before: Map<string, string>, after: Room) {
  const fresh = newlyOnTurn(before, turnMap(after));
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!fresh.length || !privateKey || !env.DB) return;
  const roomHash = await hash(after.code);
  const marks = fresh.map(() => "?").join(", ");
  const query = await env.DB.prepare(
    `SELECT id, player_id, endpoint, p256dh, auth, lang FROM push_subscriptions WHERE room_hash = ? AND expires_at > ? AND player_id IN (${marks})`,
  ).bind(roomHash, Date.now(), ...fresh.map(item => item.id)).all<PushRow>();
  await Promise.all((query.results ?? []).map(async row => {
    const label = fresh.find(item => item.id === row.player_id)?.label;
    if (!label) return;
    const lang = row.lang === "en" ? "en" : "zh";
    try {
      const status = await sendWebPush(row, { body: pushNotice(label, after.code, lang), url: `/?room=${after.code}` }, privateKey);
      if (status === 404 || status === 410) await env.DB!.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
      else if (status !== 0 && status !== 201 && status !== 200) log("warn", "push.rejected", { status });
    } catch (error) {
      log("warn", "push.failed", { reason: error instanceof Error ? error.message : "unknown" });
    }
  }));
}
