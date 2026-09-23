// Same-room record across several games (v1.9), computed from the finished
// games this device may see (RoomView.history).
import type { RoundRecord } from "./game.ts";

export type PlayerRecord = {
  id: string;
  name: string;
  seat: number;
  games: number;
  wins: number;
  goodGames: number;
  goodWins: number;
  evilGames: number;
  evilWins: number;
  merlinGames: number;
  merlinFound: number;
};

export function roomRecord(history: RoundRecord[]) {
  const players = new Map<string, PlayerRecord>();
  for (const record of history) {
    for (const player of record.players) {
      const row = players.get(player.id) ?? { id: player.id, name: player.name, seat: player.seat, games: 0, wins: 0, goodGames: 0, goodWins: 0, evilGames: 0, evilWins: 0, merlinGames: 0, merlinFound: 0 };
      const won = player.side === record.winner;
      row.name = player.name;   // The latest nickname and seat win.
      row.seat = player.seat;
      row.games += 1;
      row.wins += won ? 1 : 0;
      if (player.side === "good") { row.goodGames += 1; row.goodWins += won ? 1 : 0; }
      else { row.evilGames += 1; row.evilWins += won ? 1 : 0; }
      if (player.role === "merlin") {
        row.merlinGames += 1;
        row.merlinFound += record.reason === "merlin-assassinated" ? 1 : 0;
      }
      players.set(player.id, row);
    }
  }
  return {
    games: history.length,
    goodWins: history.filter(record => record.winner === "good").length,
    evilWins: history.filter(record => record.winner === "evil").length,
    players: [...players.values()].sort((a, b) => b.wins - a.wins || a.seat - b.seat),
  };
}
