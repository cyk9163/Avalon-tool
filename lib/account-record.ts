// Finished games for signed-in players. One row per account, room and round.
import { env } from "cloudflare:workers";
import { careerAchievementIds, gameAchievementIds, recordFact } from "./achievements.ts";
import { LANCELOTS, ROLES, currentSide, lancelotsSwitched, type Role, type Room } from "./game.ts";
import { mvpSeat, type MvpVote } from "./mvp.ts";

export type { MvpVote };

export async function recordAccountGames(room: Room): Promise<void> {
  if (!env.DB || room.phase !== "finished" || !room.game?.result) return;
  const votes = room.game.mvpVotes ?? [];
  const winners = { good: mvpSeat(votes, "good"), evil: mvpSeat(votes, "evil") };
  const merlinSeat = room.players.find(player => player.role === "merlin")?.seat;
  const seats = room.players.flatMap(player => player.role ? [{ seat: player.seat, role: player.role }] : []);
  const roleAt = (seat: number) => seats.find(player => player.seat === seat)?.role;
  const lakeCheckedSeats = (room.game.lake?.checks ?? []).map(check => check.targetSeat);
  const moment = (player: { role: Role; seat: number }) => {
    const cards = room.game!.quests.flatMap((quest, index) => {
      const vote = room.game?.questReceipts[index]?.votes.find(item => item.seat === player.seat);
      return vote ? [{ quest: quest.quest, card: vote.card, success: quest.success, failCount: quest.failCount }] : [];
    });
    return {
      role: player.role,
      seat: player.seat,
      side: currentSide(room, player),
      result: room.game!.result!,
      quests: room.game!.quests,
      proposals: room.game!.proposals,
      merlinSeat,
      seats,
      cards,
      lakeTargets: (room.game!.lake?.checks ?? []).flatMap(check => check.viewerSeat === player.seat ? [roleAt(check.targetSeat)].filter((role): role is Role => !!role) : []),
      lakeCheckedSeats,
      revealed: (room.game!.publicReveals ?? []).some(item => item.seat === player.seat),
      seesOberon: room.evilSeesOberon === true,
      sideAt: (seat: number, quest: number) => {
        const role = roleAt(seat);
        if (!role) return null;
        const side = ROLES[role].side;
        if (!LANCELOTS.includes(role) || !lancelotsSwitched(room.game!, quest)) return side;
        return side === "good" ? "evil" : "good";
      },
    };
  };
  const statements = room.players.filter(player => player.accountId && player.role).map(player => {
    const input = moment(player as { role: Role; seat: number });
    const mvp = winners[input.side] === player.seat ? 1 : 0;
    return env.DB!.prepare(
      `INSERT INTO account_games (account_id, code, round, played_at, capacity, preset, role, side, winner, mvp, fact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, code, round) DO UPDATE SET mvp = excluded.mvp, winner = excluded.winner, side = excluded.side, role = excluded.role, fact = excluded.fact`,
    ).bind(player.accountId, room.code, room.round ?? 1, Date.now(), room.capacity, room.preset, player.role as Role, input.side, room.game!.result!.winner, mvp, recordFact(input));
  });
  if (statements.length) await env.DB.batch(statements);
  for (const player of room.players) {
    if (!player.accountId || !player.role || !room.game?.result) continue;
    const fromGame = gameAchievementIds(moment(player as { role: Role; seat: number }));
    const stored = await env.DB.prepare("SELECT role, side, winner, mvp, fact FROM account_games WHERE account_id = ? ORDER BY played_at ASC").bind(player.accountId).all<{ role: string; side: string; winner: string; mvp: number; fact: string | null }>();
    const ids = [...new Set([...fromGame, ...careerAchievementIds(stored.results ?? [])])];
    if (!ids.length) continue;
    await env.DB.batch(ids.map(id => env.DB!.prepare(
      "INSERT OR IGNORE INTO account_achievements (account_id, achievement_id, unlocked_at) VALUES (?, ?, ?)",
    ).bind(player.accountId, id, Date.now())));
  }
}
