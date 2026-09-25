import { accountCookie, loginAccount, logoutAccount, readAccount, registerAccount } from "@/lib/account";
import { GameError } from "@/lib/game";
import { newRequestId } from "@/lib/log";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, cookie?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}

export async function GET(request: Request) {
  try {
    const account = await readAccount(request);
    if (!account || !env.DB) return json({ account: null, games: [], stats: null });
    const games = await env.DB.prepare(
      "SELECT code, round, played_at as at, capacity, preset, role, side, winner, mvp FROM account_games WHERE account_id = ? ORDER BY played_at DESC LIMIT 200",
    ).bind(account.id).all<{ code: string; round: number; at: number; capacity: number; preset: string; role: string; side: "good" | "evil"; winner: "good" | "evil"; mvp: number }>();
    const rows = games.results ?? [];
    const byRole = new Map<string, { played: number; won: number }>();
    let won = 0;
    let mvp = 0;
    const bySide = { good: { played: 0, won: 0 }, evil: { played: 0, won: 0 } };
    for (const row of rows) {
      const victory = row.side === row.winner;
      if (victory) won += 1;
      if (row.mvp) mvp += 1;
      bySide[row.side].played += 1;
      if (victory) bySide[row.side].won += 1;
      const role = byRole.get(row.role) ?? { played: 0, won: 0 };
      role.played += 1;
      if (victory) role.won += 1;
      byRole.set(row.role, role);
    }
    return json({
      account,
      games: rows,
      stats: { total: rows.length, won, mvp, bySide, byRole: [...byRole.entries()].map(([role, count]) => ({ role, ...count })) },
    });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "账号服务暂时不可用。";
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const secure = new URL(request.url).protocol === "https:";
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "logout") {
      await logoutAccount(request);
      return json({ account: null }, 200, accountCookie("", secure, true));
    }
    const result = body.action === "register"
      ? await registerAccount(body.name, body.password)
      : await loginAccount(body.name, body.password);
    return json({ account: result.account }, 200, accountCookie(result.token, secure));
  } catch (error) {
    const message = error instanceof GameError ? error.message : `账号服务暂时不可用。（错误编号 ${requestId.slice(0, 8)}）`;
    return json({ error: message }, error instanceof GameError ? error.status : 503);
  }
}
