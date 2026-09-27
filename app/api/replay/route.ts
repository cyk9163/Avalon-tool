import { readAccount } from "@/lib/account";
import { GameError } from "@/lib/game";
import { parseStoredReplay, publicReplay } from "@/lib/saved-replay";
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

export async function GET(request: Request) {
  try {
    const account = await readAccount(request);
    if (!account) throw new GameError("请先登录。", 401);
    if (!env.DB) throw new GameError("复盘暂时打不开。", 503);
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const round = Number(url.searchParams.get("round"));
    if (!/^\d{6}$/.test(code) || !Number.isInteger(round) || round < 1 || round > 99) throw new GameError("这一局没有留下复盘。", 404);
    const played = await env.DB.prepare(
      "SELECT 1 as ok FROM account_games WHERE account_id = ? AND code = ? AND round = ?",
    ).bind(account.id, code, round).first<{ ok: number }>();
    if (!played) throw new GameError("这一局没有留下复盘。", 404);
    const row = await env.DB.prepare(
      "SELECT body FROM game_replays WHERE code = ? AND round = ?",
    ).bind(code, round).first<{ body: string }>();
    if (!row || row.body.length > 100_000) throw new GameError("这一局没有留下复盘。", 404);
    let parsed: unknown;
    try { parsed = JSON.parse(row.body); } catch { throw new GameError("这一局没有留下复盘。", 404); }
    const stored = parseStoredReplay(parsed);
    const replay = stored ? publicReplay(stored, account.id) : null;
    if (!replay) throw new GameError("这一局没有留下复盘。", 404);
    return json(replay);
  } catch (error) {
    const message = error instanceof GameError ? error.message : "复盘暂时打不开。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
