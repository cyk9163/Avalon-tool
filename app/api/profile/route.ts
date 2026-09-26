import { achievementById } from "@/lib/achievements";
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
      "SELECT role, side, winner, mvp FROM account_games WHERE account_id = ? ORDER BY played_at DESC LIMIT 200",
    ).bind(id).all<{ role: string; side: "good" | "evil"; winner: "good" | "evil"; mvp: number }>();
    const rows = games.results ?? [];
    const byRole = new Map<string, { played: number; won: number }>();
    let won = 0;
    let mvp = 0;
    for (const row of rows) {
      const victory = row.side === row.winner;
      if (victory) won += 1;
      if (row.mvp) mvp += 1;
      const role = byRole.get(row.role) ?? { played: 0, won: 0 };
      role.played += 1;
      if (victory) role.won += 1;
      byRole.set(row.role, role);
    }
    const unlocked = await env.DB.prepare("SELECT achievement_id as id FROM account_achievements WHERE account_id = ? ORDER BY unlocked_at DESC").bind(id).all<{ id: string }>();
    const titles = (unlocked.results ?? []).map(row => achievementById(row.id)?.name).filter((name): name is string => Boolean(name));
    return json({
      name: account.name,
      title: account.title ? achievementById(account.title)?.name ?? null : null,
      avatar: account.avatar,
      titles,
      stats: {
        total: rows.length,
        won,
        mvp,
        byRole: [...byRole.entries()].map(([role, count]) => ({ role, ...count })),
      },
    });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "主页暂时打不开。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
