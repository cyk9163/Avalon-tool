// Finished games for signed-in players. One row per account, room and round.
import { env } from "cloudflare:workers";
import { careerAchievementIds, gameAchievementIds, gameFact } from "./achievements.ts";
import { currentSide, type Role, type Room } from "./game.ts";
import { mvpSeat, type MvpVote } from "./mvp.ts";

export type { MvpVote };

export async function recordAccountGames(room: Room): Promise<void> {
  if (!env.DB || room.phase !== "finished" || !room.game?.result) return;
  const votes = room.game.mvpVotes ?? [];
  const winners = { good: mvpSeat(votes, "good"), evil: mvpSeat(votes, "evil") };
  const statements = room.players.filter(player => player.accountId && player.role).map(player => {
    const side = currentSide(room, player);
    const mvp = winners[side] === player.seat ? 1 : 0;
    return env.DB!.prepare(
      `INSERT INTO account_games (account_id, code, round, played_at, capacity, preset, role, side, winner, mvp, fact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, code, round) DO UPDATE SET mvp = excluded.mvp, winner = excluded.winner, side = excluded.side, role = excluded.role, fact = excluded.fact`,
    ).bind(player.accountId, room.code, room.round ?? 1, Date.now(), room.capacity, room.preset, player.role as Role, side, room.game!.result!.winner, mvp, gameFact(player.role ?? "", room.game!.result!));
  });
  if (statements.length) await env.DB.batch(statements);
  const merlinSeat = room.players.find(player => player.role === "merlin")?.seat;
  for (const player of room.players) {
    if (!player.accountId || !player.role || !room.game) continue;
    const side = currentSide(room, player);
    const fromGame = gameAchievementIds({
      role: player.role,
      seat: player.seat,
      side,
      result: room.game.result,
      quests: room.game.quests,
      proposals: room.game.proposals,
      merlinSeat,
    });
    const stored = await env.DB.prepare("SELECT role, side, winner, mvp, fact FROM account_games WHERE account_id = ?").bind(player.accountId).all<{ role: string; side: string; winner: string; mvp: number; fact: string | null }>();
    const ids = [...new Set([...fromGame, ...careerAchievementIds(stored.results ?? [])])];
    if (!ids.length) continue;
    await env.DB.batch(ids.map(id => env.DB!.prepare(
      "INSERT OR IGNORE INTO account_achievements (account_id, achievement_id, unlocked_at) VALUES (?, ?, ?)",
    ).bind(player.accountId, id, Date.now())));
  }
}
