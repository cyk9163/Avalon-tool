import { achievementById, achievementProgress } from "@/lib/achievements";
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

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[a-f0-9]{32}$/.test(id) || !env.DB) throw new GameError("找不到这位玩家。", 404);
    const account = await env.DB.prepare("SELECT id, name, title, avatar FROM accounts WHERE id = ?").bind(id).first<{ id: string; name: string; title: string | null; avatar: string | null }>();
    if (!account) throw new GameError("找不到这位玩家。", 404);
    const games = await env.DB.prepare(
      "SELECT role, side, winner, mvp, fact FROM account_games WHERE account_id = ? ORDER BY played_at DESC LIMIT 200",
    ).bind(id).all<{ role: string; side: "good" | "evil"; winner: "good" | "evil"; mvp: number; fact: string | null }>();
    const rows = games.results ?? [];
    const bySide = { good: { played: 0, won: 0 }, evil: { played: 0, won: 0 } };
    let won = 0;
    for (const row of rows) {
      const victory = row.side === row.winner;
      if (victory) won += 1;
      bySide[row.side].played += 1;
      if (victory) bySide[row.side].won += 1;
    }
    const unlocked = await env.DB.prepare("SELECT achievement_id as id FROM account_achievements WHERE account_id = ?").bind(id).all<{ id: string }>();
    return json({
      name: account.name,
      title: account.title ? achievementById(account.title)?.name ?? null : null,
      avatar: account.avatar,
      achievements: achievementProgress((unlocked.results ?? []).map(row => row.id)),
      stats: { total: rows.length, won, bySide },
      games: rows.map(row => ({ role: row.role, won: row.side === row.winner, mvp: row.mvp === 1, fact: row.fact })),
    });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "主页暂时打不开。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
