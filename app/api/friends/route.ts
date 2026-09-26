import { achievementById } from "@/lib/achievements";
import { readAccount } from "@/lib/account";
import { GameError } from "@/lib/game";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

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

type FriendRow = { id: string; name: string; avatar: string | null; title: string | null };

function present(row: FriendRow) {
  return { id: row.id, name: row.name, avatar: row.avatar, title: row.title ? achievementById(row.title)?.name ?? null : null };
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

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    const rows = await db().prepare(
      "SELECT a.id, a.name, a.avatar, a.title FROM friendships f JOIN accounts a ON a.id = f.friend_id WHERE f.account_id = ? ORDER BY f.created_at DESC",
    ).bind(account.id).all<FriendRow>();
    return json({ friends: (rows.results ?? []).map(present) });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "好友服务暂时不可用。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    const body = await request.json() as { action?: unknown; name?: unknown; id?: unknown };
    if (body.action === "search") {
      if (typeof body.name !== "string") throw new GameError("请输入要搜索的名字。", 400);
      const name = body.name.trim().normalize("NFC");
      if (name.length < 2 || name.length > 16) throw new GameError("请输入要搜索的名字。", 400);
      const like = `${name.replace(/[\\%_]/g, "")}%`;
      const rows = await db().prepare(
        "SELECT id, name, avatar, title FROM accounts WHERE id != ? AND (name = ? OR name LIKE ?) ORDER BY name = ? DESC, name LIMIT 8",
      ).bind(account.id, name, like, name).all<FriendRow>();
      const mine = await db().prepare("SELECT friend_id as id FROM friendships WHERE account_id = ?").bind(account.id).all<{ id: string }>();
      const added = new Set((mine.results ?? []).map(row => row.id));
      return json({ results: (rows.results ?? []).map(row => ({ ...present(row), added: added.has(row.id) })) });
    }
    if (body.action === "add") {
      if (typeof body.name !== "string") throw new GameError("请输入要搜索的名字。", 400);
      const name = body.name.trim().normalize("NFC");
      const other = await db().prepare("SELECT id, name, avatar, title FROM accounts WHERE name = ?").bind(name).first<FriendRow>();
      if (!other) throw new GameError("没有找到这个账号。", 404);
      if (other.id === account.id) throw new GameError("不能加自己。", 400);
      const now = Date.now();
      await db().batch([
        db().prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at) VALUES (?, ?, ?)").bind(account.id, other.id, now),
        db().prepare("INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at) VALUES (?, ?, ?)").bind(other.id, account.id, now),
      ]);
      return json({ friend: present(other) });
    }
    if (body.action === "remove") {
      if (typeof body.id !== "string" || !/^[a-f0-9]{32}$/.test(body.id)) throw new GameError("没有找到这个账号。", 404);
      await db().batch([
        db().prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(account.id, body.id),
        db().prepare("DELETE FROM friendships WHERE account_id = ? AND friend_id = ?").bind(body.id, account.id),
      ]);
      return json({ ok: true });
    }
    throw new GameError("请输入要搜索的名字。", 400);
  } catch (error) {
    const message = error instanceof GameError ? error.message : "好友服务暂时不可用。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
