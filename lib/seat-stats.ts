// Per-seat statistics from the public game record (v1.7): shared by the vote
// matrix on screen and the exported recap. Uses only public data.
import type { GameView, RoomView } from "./game.ts";

export type SeatStats = { seat: number; led: number; picked: number; played: number; approvals: number; votes: number };

export function seatStats(room: Pick<RoomView, "players">, game: Pick<GameView, "proposals" | "quests">): SeatStats[] {
  return room.players.map(({ seat }) => {
    const votes = game.proposals.flatMap(proposal => proposal.votes.filter(vote => vote.seat === seat));
    return {
      seat,
      led: game.proposals.filter(proposal => proposal.leaderSeat === seat).length,
      picked: game.proposals.filter(proposal => proposal.team.includes(seat)).length,
      played: game.quests.filter(quest => quest.team.includes(seat)).length,
      approvals: votes.filter(vote => vote.approve).length,
      votes: votes.length,
    };
  }).sort((a, b) => a.seat - b.seat);
}
