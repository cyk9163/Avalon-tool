export type MvpVote = { accountId: string; seat: number; side: "good" | "evil" };

/** The unique top vote on a side. A tie means that side has no MVP. */
export function mvpSeat(votes: MvpVote[], side: "good" | "evil"): number | null {
  const counts = new Map<number, number>();
  for (const vote of votes) if (vote.side === side) counts.set(vote.seat, (counts.get(vote.seat) ?? 0) + 1);
  let best = 0;
  let seats: number[] = [];
  for (const [seat, count] of counts) {
    if (count > best) { best = count; seats = [seat]; }
    else if (count === best) seats.push(seat);
  }
  return best > 0 && seats.length === 1 ? seats[0] : null;
}
