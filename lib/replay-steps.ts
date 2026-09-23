// Replay timeline for a finished game (v1.12). Built only from the viewer's
// GameView: proposals, quests, quest cards and the viewer's own lake checks.
// Quest-card authors are included only when the view already has them (after
// the game, members only). Lake steps name who handed the token to whom and
// never include the private side. The public hand-off chain of other players
// is not in GameView, so only this viewer's own checks appear.
import type { GameView, QuestCard } from "./game.ts";

export type ReplayProgress = { quest: number; success: boolean; failCount: number };

type StepBase = {
  quest: number;
  attempt: number;
  leaderSeat: number;
  good: number;
  evil: number;
  completed: ReplayProgress[];
};

export type ReplayStep =
  | (StepBase & {
    kind: "proposal";
    team: number[];
    votes: { seat: number; approve: boolean }[];
    approved: boolean;
  })
  | (StepBase & {
    kind: "quest";
    team: number[];
    failCount: number;
    success: boolean;
    // null while cards are still secret; an array once the game has revealed them.
    cards: { seat: number; card: QuestCard }[] | null;
  })
  | (StepBase & {
    kind: "lake";
    fromSeat: number;
    toSeat: number;
  });

export type TableReplay = {
  leaderSeat: number;
  team: number[];
  votedSeats: number[];
  quest: number;
  attempt: number;
  lakeSeat: number | null;
  focus: ReplayStep["kind"];
};

/** What the round table should show for one replay step. */
export function tableSnapshot(step: ReplayStep): TableReplay {
  if (step.kind === "proposal") {
    return {
      leaderSeat: step.leaderSeat,
      team: step.team,
      votedSeats: step.votes.map(vote => vote.seat),
      quest: step.quest,
      attempt: step.attempt,
      lakeSeat: null,
      focus: "proposal",
    };
  }
  if (step.kind === "quest") {
    return {
      leaderSeat: step.leaderSeat,
      team: step.team,
      votedSeats: [],
      quest: step.quest,
      attempt: step.attempt,
      lakeSeat: null,
      focus: "quest",
    };
  }
  return {
    leaderSeat: step.leaderSeat,
    team: [],
    votedSeats: [],
    quest: step.quest,
    attempt: step.attempt,
    lakeSeat: step.toSeat,
    focus: "lake",
  };
}

function score(completed: ReplayProgress[]) {
  return {
    good: completed.filter(item => item.success).length,
    evil: completed.filter(item => !item.success).length,
  };
}

/**
 * Ordered steps for a member of a finished game. Spectators (no revealed
 * roles, or no seat) get nothing — the replay is not for them.
 */
export function replaySteps(game: GameView | null | undefined, meSeat: number | null): ReplayStep[] {
  if (!game?.result || !game.revealedRoles || meSeat == null) return [];
  const steps: ReplayStep[] = [];
  const completed: ReplayProgress[] = [];
  const seenQuests = new Set<number>();
  for (const proposal of game.proposals) {
    const before = score(completed);
    steps.push({
      kind: "proposal",
      quest: proposal.quest,
      attempt: proposal.attempt,
      leaderSeat: proposal.leaderSeat,
      team: [...proposal.team],
      votes: proposal.votes.map(vote => ({ seat: vote.seat, approve: vote.approve })),
      approved: proposal.approved,
      ...before,
      completed: completed.map(item => ({ ...item })),
    });
    if (!proposal.approved || seenQuests.has(proposal.quest)) continue;
    const quest = game.quests.find(item => item.quest === proposal.quest);
    if (!quest) continue;
    seenQuests.add(quest.quest);
    completed.push({ quest: quest.quest, success: quest.success, failCount: quest.failCount });
    const after = score(completed);
    const cards = game.questCards
      ? (game.questCards.find(item => item.quest === quest.quest)?.cards ?? []).map(card => ({ seat: card.seat, card: card.card }))
      : null;
    steps.push({
      kind: "quest",
      quest: quest.quest,
      attempt: proposal.attempt,
      leaderSeat: proposal.leaderSeat,
      team: [...quest.team],
      failCount: quest.failCount,
      success: quest.success,
      cards,
      ...after,
      completed: completed.map(item => ({ ...item })),
    });
    const check = game.lake?.myChecks.find(item => item.quest === quest.quest);
    if (!check || check.targetSeat === meSeat) continue;
    steps.push({
      kind: "lake",
      quest: quest.quest,
      attempt: proposal.attempt,
      leaderSeat: proposal.leaderSeat,
      fromSeat: meSeat,
      toSeat: check.targetSeat,
      ...after,
      completed: completed.map(item => ({ ...item })),
    });
  }
  return steps;
}
