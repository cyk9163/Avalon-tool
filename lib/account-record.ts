// Finished games for signed-in players. One row per account, room and round.
import { env } from "cloudflare:workers";
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
      `INSERT INTO account_games (account_id, code, round, played_at, capacity, preset, role, side, winner, mvp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, code, round) DO UPDATE SET mvp = excluded.mvp, winner = excluded.winner, side = excluded.side, role = excluded.role`,
    ).bind(player.accountId, room.code, room.round ?? 1, Date.now(), room.capacity, room.preset, player.role as Role, side, room.game!.result!.winner, mvp);
  });
  if (statements.length) await env.DB.batch(statements);
}
