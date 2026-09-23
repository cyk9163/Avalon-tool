// Checks a browser's push subscription before it is stored. No database access.
import { GameError, type Room } from "./game.ts";
import type { Lang } from "./i18n/core.ts";
import { base64UrlToBytes } from "./web-push.ts";

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; lang: Lang };

const BLOCKED_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i;

export function validatePushSubscription(input: Record<string, unknown>): PushSubscriptionInput {
  const { endpoint, p256dh, auth } = input;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") throw new GameError("推送订阅无效。", 400);
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new GameError("推送订阅无效。", 400); }
  if (url.protocol !== "https:" || endpoint.length > 1000 || BLOCKED_HOST.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new GameError("推送订阅无效。", 400);
  }
  let publicKey: Uint8Array, secret: Uint8Array;
  try {
    publicKey = base64UrlToBytes(p256dh);
    secret = base64UrlToBytes(auth);
  } catch { throw new GameError("推送订阅无效。", 400); }
  if (publicKey.length !== 65 || secret.length !== 16) throw new GameError("推送订阅无效。", 400);
  return { endpoint, p256dh, auth, lang: input.lang === "en" ? "en" : "zh" };
}

export function requirePushMember(room: Pick<Room, "players">, key: string) {
  const me = room.players.find(player => player.key === key);
  if (!me) throw new GameError("请先加入房间。", 403);
  return me;
}
