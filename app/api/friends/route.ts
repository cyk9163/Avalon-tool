import { achievementById } from "@/lib/achievements";
import { readAccount } from "@/lib/account";
import { GameError, type Room } from "@/lib/game";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const ONLINE_MS = 45_000;
const INVITE_MS = 15 * 60 * 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

type FriendRow = { id: string; name: string; avatar: string | null; title: string | null; last_seen?: number | null };

function present(row: FriendRow, now = Date.now()) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    title: row.title ? achievementById(row.title)?.name ?? null : null,
    online: typeof row.last_seen === "number" && now - row.last_seen < ONLINE_MS,
  };
}

function db() {
  if (!env.DB) throw new GameError("好友服务暂时不可用。", 503);
  return env.DB;
}

async function requireAccount(request: Request) {
  const account = await readAccount(request);
  if (!account) throw new GameError("请先登录。", 401);
  return account;
}

function accountId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

async function linkFriends(left: string, right: string) {
  const now = Date.now();
  await db().batch([
    db().prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at) VALUES (?, ?, ?)").bind(left, right, now),
    db().prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at) VALUES (?, ?, ?)").bind(right, left, now),
    db().prepare("DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)").bind(left, right, right, left),
  ]);
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    const now = Date.now();
    await db().prepare("UPDATE accounts SET last_seen = ? WHERE id = ?").bind(now, account.id).run();
    const rows = await db().prepare(
      "SELECT a.id, a.name, a.avatar, a.title, a.last_seen FROM friendships f JOIN accounts a ON a.id = f.friend_id WHERE f.account_id = ? ORDER BY f.created_at DESC",
    ).bind(account.id).all<FriendRow>();
    const incoming = await db().prepare(
      "SELECT a.id, a.name, a.avatar, a.title, a.last_seen FROM friend_requests r JOIN accounts a ON a.id = r.from_id WHERE r.to_id = ? ORDER BY r.created_at DESC",
    ).bind(account.id).all<FriendRow>();
    const invite = await db().prepare(
      `SELECT i.id, i.code, i.invite, a.name as fromName
       FROM room_invites i JOIN accounts a ON a.id = i.from_id
       WHERE i.to_id = ? AND i.created_at > ? ORDER BY i.created_at DESC LIMIT 1`,
    ).bind(account.id, now - INVITE_MS).first<{ id: string; code: string; invite: string | null; fromName: string }>();
    return json({
      friends: (rows.results ?? []).map(row => present(row, now)),
      requests: (incoming.results ?? []).map(row => present(row, now)),
      invite: invite ? { id: invite.id, code: invite.code, invite: invite.invite, from: invite.fromName } : null,
    });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "好友服务暂时不可用。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    const body = await request.json() as { action?: unknown; name?: unknown; id?: unknown; code?: unknown };
    if (body.action === "search") {
      if (typeof body.name !== "string") throw new GameError("请输入要搜索的名字。", 400);
      const name = body.name.trim().normalize("NFC");
      if (name.length < 2 || name.length > 16) throw new GameError("请输入要搜索的名字。", 400);
      const like = `${name.replace(/[\\%_]/g, "")}%`;
      const rows = await db().prepare(
        "SELECT id, name, avatar, title, last_seen FROM accounts WHERE id != ? AND (name = ? OR name LIKE ?) ORDER BY name = ? DESC, name LIMIT 8",
      ).bind(account.id, name, like, name).all<FriendRow>();
      const mine = await db().prepare("SELECT friend_id as id FROM friendships WHERE account_id = ?").bind(account.id).all<{ id: string }>();
      const sent = await db().prepare("SELECT to_id as id FROM friend_requests WHERE from_id = ?").bind(account.id).all<{ id: string }>();
      const added = new Set((mine.results ?? []).map(row => row.id));
      const pending = new Set((sent.results ?? []).map(row => row.id));
      return json({ results: (rows.results ?? []).map(row => ({ ...present(row), added: added.has(row.id), pending: pending.has(row.id) })) });
    }
    if (body.action === "add") {
      if (typeof body.name !== "string") throw new GameError("请输入要搜索的名字。", 400);
      const name = body.name.trim().normalize("NFC");
      const other = await db().prepare("SELECT id, name, avatar, title, last_seen FROM accounts WHERE name = ?").bind(name).first<FriendRow>();
      if (!other) throw new GameError("没有找到这个账号。", 404);
      if (other.id === account.id) throw new GameError("不能加自己。", 400);
      const already = await db().prepare("SELECT 1 as ok FROM friendships WHERE account_id = ? AND friend_id = ?").bind(account.id, other.id).first();
      if (already) return json({ friend: present(other), status: "added" });
      const reverse = await db().prepare("SELECT 1 as ok FROM friend_requests WHERE from_id = ? AND to_id = ?").bind(other.id, account.id).first();
      if (reverse) {
        await linkFriends(account.id, other.id);
        return json({ friend: present(other), status: "added" });
      }
      await db().prepare("INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)").bind(account.id, other.id, Date.now()).run();
      return json({ friend: present(other), status: "pending" });
    }
    if (body.action === "accept" || body.action === "reject") {
      const id = accountId(body.id);
      if (!id) throw new GameError("没有找到这个账号。", 404);
      const requestRow = await db().prepare("SELECT 1 as ok FROM friend_requests WHERE from_id = ? AND to_id = ?").bind(id, account.id).first();
      if (!requestRow) throw new GameError("没有找到这个账号。", 404);
      if (body.action === "accept") await linkFriends(account.id, id);
      else await db().prepare("DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?").bind(id, account.id).run();
      return json({ ok: true });
    }
    if (body.action === "remove") {
      const id = accountId(body.id);
      if (!id) throw new GameError("没有找到这个账号。", 404);
      await db().batch([
        db().prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(account.id, id),
        db().prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(id, account.id),
      ]);
      return json({ ok: true });
    }
    if (body.action === "invite") {
      const id = accountId(body.id);
      if (!id || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) throw new GameError("没有找到这个账号。", 404);
      const friend = await db().prepare("SELECT 1 as ok FROM friendships WHERE account_id = ? AND friend_id = ?").bind(account.id, id).first();
      if (!friend) throw new GameError("对方还不是你的好友。", 403);
      const row = await db().prepare("SELECT state FROM rooms WHERE code = ? AND expires_at > ?").bind(body.code, Date.now()).first<{ state: string }>();
      if (!row) throw new GameError("房间不存在或已过期，请检查房间码。", 404);
      const room = JSON.parse(row.state) as Room;
      if (room.phase !== "lobby") throw new GameError("房间已发身份，不能中途加入。", 403);
      if (room.players.length >= room.capacity) throw new GameError("房间已满。", 403);
      if (!room.players.some(player => player.accountId === account.id)) throw new GameError("请先加入房间。", 403);
      if (room.players.some(player => player.accountId === id)) throw new GameError("这位好友已经在房间里。", 400);
      const inviteId = crypto.randomUUID().replace(/-/g, "");
      await db().prepare("DELETE FROM room_invites WHERE from_id = ? AND to_id = ?").bind(account.id, id).run();
      await db().prepare(
        "INSERT INTO room_invites (id, from_id, to_id, code, invite, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(inviteId, account.id, id, room.code, room.inviteToken ?? null, Date.now()).run();
      return json({ ok: true });
    }
    if (body.action === "decline-invite") {
      const id = accountId(body.id);
      if (!id) throw new GameError("没有找到这个账号。", 404);
      await db().prepare("DELETE FROM room_invites WHERE id = ? AND to_id = ?").bind(id, account.id).run();
      return json({ ok: true });
    }
    throw new GameError("请输入要搜索的名字。", 400);
  } catch (error) {
    const message = error instanceof GameError ? error.message : "好友服务暂时不可用。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
