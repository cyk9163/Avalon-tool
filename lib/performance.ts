import { ROLES, type Role } from "./game/model.ts";

type Vote = { seat: number; approve: boolean };
type Proposal = { team: number[]; votes: Vote[]; quest?: number; approved?: boolean };
type Card = { quest: number; card: "success" | "fail" };

export type ScoreInput = {
  seat: number;
  side: "good" | "evil";
  role: string;
  result: { winner: "good" | "evil"; reason: string };
  proposals?: Proposal[];
  cards?: Card[];
  seats?: { seat: number; role: string }[];
  sideAt?: (seat: number, quest: number) => "good" | "evil" | null;
};

function sideOf(input: ScoreInput, seat: number, quest: number): "good" | "evil" | null {
  const timed = input.sideAt?.(seat, quest);
  if (timed) return timed;
  const role = input.seats?.find(player => player.seat === seat)?.role;
  if (!role || !(role in ROLES)) return null;
  return ROLES[role as Role].side;
}

/** 0–100. After the game, each team vote is scored by who was actually on that team. */
export function performanceScore(input: ScoreInput): number {
  let hit = 0;
  let total = 0;
  for (const proposal of input.proposals ?? []) {
    const vote = proposal.votes.find(item => item.seat === input.seat);
    if (!vote || proposal.quest == null) continue;
    const sides = proposal.team.map(seat => sideOf(input, seat, proposal.quest ?? 0));
    if (sides.some(side => side == null)) continue;
    const wolfish = sides.includes("evil");
    const shouldApprove = input.side === "good" ? !wolfish : wolfish;
    total += 1;
    if (vote.approve === shouldApprove) hit += 1;
  }
  for (const card of input.cards ?? []) {
    total += 1;
    const fail = card.card === "fail";
    if (input.side === "good" ? !fail : fail) hit += 1;
  }
  if (input.role === "assassin" && (input.result.reason === "merlin-assassinated" || input.result.reason === "assassin-missed")) {
    total += 1;
    if (input.result.reason === "merlin-assassinated") hit += 1;
  }
  if (input.role === "merlin" && (input.result.reason === "merlin-assassinated" || input.result.reason === "assassin-missed")) {
    total += 1;
    if (input.result.reason === "assassin-missed") hit += 1;
  }
  if (total === 0) return input.side === input.result.winner ? 60 : 40;
  return Math.round(hit / total * 100);
}
