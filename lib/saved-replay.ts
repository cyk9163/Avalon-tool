// A finished game, kept so a player can open the recap from their record.
// Account ids stay in the stored copy and are removed before anything is sent.
import { failsRequired, teamSize, ROLES, type GameResult, type GameView, type QuestCard, type Role, type Room } from "./game.ts";

export type StoredReplay = {
  v: 1;
  capacity: number;
  players: { seat: number; name: string; role: Role }[];
  members: { accountId: string; seat: number }[];
  proposals: { quest: number; attempt: number; leaderSeat: number; team: number[]; votes: { seat: number; approve: boolean }[]; approved: boolean }[];
  quests: { quest: number; team: number[]; failCount: number; success: boolean }[];
  cards: { quest: number; cards: { seat: number; card: QuestCard }[] }[];
  result: GameResult;
  checks: { quest: number; viewerSeat: number; targetSeat: number; side: "good" | "evil" }[];
};

export type PublicReplay = {
  meSeat: number;
  capacity: number;
  players: StoredReplay["players"];
  proposals: StoredReplay["proposals"];
  quests: StoredReplay["quests"];
  cards: StoredReplay["cards"];
  result: GameResult;
  checks: { quest: number; targetSeat: number; side: "good" | "evil" }[];
};

const REASONS = new Set(["three-failures", "five-rejections", "merlin-assassinated", "assassin-missed"]);

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function seats(value: unknown, capacity: number): number[] | null {
  if (!Array.isArray(value) || value.length > capacity) return null;
  const list: number[] = [];
  for (const seat of value) {
    const parsed = whole(seat, 1, capacity);
    if (parsed == null) return null;
    list.push(parsed);
  }
  return list;
}

export function savedReplay(room: Room): StoredReplay | null {
  const game = room.game;
  if (!game?.result || !REASONS.has(game.result.reason)) return null;
  const players = room.players.flatMap(player => player.role ? [{
    seat: player.seat,
    name: player.name.slice(0, 24),
    role: player.role,
  }] : []);
  if (!players.length) return null;
  return {
    v: 1,
    capacity: room.capacity,
    players,
    members: room.players.flatMap(player => player.accountId && player.role ? [{ accountId: player.accountId, seat: player.seat }] : []),
    proposals: game.proposals.map(proposal => ({
      quest: proposal.quest,
      attempt: proposal.attempt,
      leaderSeat: proposal.leaderSeat,
      team: [...proposal.team],
      votes: proposal.votes.map(vote => ({ seat: vote.seat, approve: vote.approve })),
      approved: proposal.approved,
    })),
    quests: game.quests.map(quest => ({ quest: quest.quest, team: [...quest.team], failCount: quest.failCount, success: quest.success })),
    cards: game.quests.map((quest, index) => ({
      quest: quest.quest,
      cards: (game.questReceipts[index]?.votes ?? []).map(vote => ({ seat: vote.seat, card: vote.card })),
    })),
    result: {
      winner: game.result.winner,
      reason: game.result.reason,
      ...(game.result.targetSeat !== undefined ? { targetSeat: game.result.targetSeat } : {}),
      ...(game.result.early ? { early: true } : {}),
    },
    checks: (game.lake?.checks ?? []).map(check => ({
      quest: check.quest, viewerSeat: check.viewerSeat, targetSeat: check.targetSeat, side: check.side,
    })),
  };
}

export function parseStoredReplay(value: unknown): StoredReplay | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const capacity = whole(body.capacity, 5, 10);
  if (body.v !== 1 || capacity == null || !Array.isArray(body.players) || body.players.length > capacity) return null;
  const players: StoredReplay["players"] = [];
  for (const item of body.players) {
    if (!item || typeof item !== "object") return null;
    const player = item as Record<string, unknown>;
    const seat = whole(player.seat, 1, capacity);
    const role = player.role;
    if (seat == null || typeof player.name !== "string" || typeof role !== "string" || !(role in ROLES)) return null;
    players.push({ seat, name: player.name.slice(0, 24), role: role as Role });
  }
  if (!Array.isArray(body.members) || body.members.length > capacity) return null;
  const members: StoredReplay["members"] = [];
  for (const item of body.members) {
    if (!item || typeof item !== "object") return null;
    const member = item as Record<string, unknown>;
    const seat = whole(member.seat, 1, capacity);
    if (seat == null || typeof member.accountId !== "string" || !/^[a-f0-9]{32}$/.test(member.accountId)) return null;
    members.push({ accountId: member.accountId, seat });
  }
  if (!Array.isArray(body.proposals) || body.proposals.length > 40) return null;
  const proposals: StoredReplay["proposals"] = [];
  for (const item of body.proposals) {
    if (!item || typeof item !== "object") return null;
    const proposal = item as Record<string, unknown>;
    const quest = whole(proposal.quest, 1, 5);
    const attempt = whole(proposal.attempt, 1, 5);
    const leaderSeat = whole(proposal.leaderSeat, 1, capacity);
    const team = seats(proposal.team, capacity);
    if (quest == null || attempt == null || leaderSeat == null || !team || typeof proposal.approved !== "boolean" || !Array.isArray(proposal.votes)) return null;
    const votes: StoredReplay["proposals"][number]["votes"] = [];
    for (const vote of proposal.votes) {
      if (!vote || typeof vote !== "object") return null;
      const ballot = vote as Record<string, unknown>;
      const seat = whole(ballot.seat, 1, capacity);
      if (seat == null || typeof ballot.approve !== "boolean") return null;
      votes.push({ seat, approve: ballot.approve });
    }
    proposals.push({ quest, attempt, leaderSeat, team, votes, approved: proposal.approved });
  }
  if (!Array.isArray(body.quests) || body.quests.length > 5 || !Array.isArray(body.cards)) return null;
  const quests: StoredReplay["quests"] = [];
  for (const item of body.quests) {
    if (!item || typeof item !== "object") return null;
    const quest = item as Record<string, unknown>;
    const number = whole(quest.quest, 1, 5);
    const team = seats(quest.team, capacity);
    const failCount = whole(quest.failCount, 0, capacity);
    if (number == null || !team || failCount == null || typeof quest.success !== "boolean") return null;
    quests.push({ quest: number, team, failCount, success: quest.success });
  }
  const cards: StoredReplay["cards"] = [];
  for (const item of body.cards) {
    if (!item || typeof item !== "object") return null;
    const group = item as Record<string, unknown>;
    const quest = whole(group.quest, 1, 5);
    if (quest == null || !Array.isArray(group.cards)) return null;
    const played: StoredReplay["cards"][number]["cards"] = [];
    for (const card of group.cards) {
      if (!card || typeof card !== "object") return null;
      const playedCard = card as Record<string, unknown>;
      const seat = whole(playedCard.seat, 1, capacity);
      if (seat == null || (playedCard.card !== "success" && playedCard.card !== "fail")) return null;
      played.push({ seat, card: playedCard.card });
    }
    cards.push({ quest, cards: played });
  }
  if (!body.result || typeof body.result !== "object") return null;
  const result = body.result as Record<string, unknown>;
  if ((result.winner !== "good" && result.winner !== "evil") || typeof result.reason !== "string" || !REASONS.has(result.reason)) return null;
  let targetSeat: number | undefined;
  if (result.targetSeat !== undefined) {
    const parsed = whole(result.targetSeat, 1, capacity);
    if (parsed == null) return null;
    targetSeat = parsed;
  }
  if (!Array.isArray(body.checks) || body.checks.length > 10) return null;
  const checks: StoredReplay["checks"] = [];
  for (const item of body.checks) {
    if (!item || typeof item !== "object") return null;
    const check = item as Record<string, unknown>;
    const quest = whole(check.quest, 1, 5);
    const viewerSeat = whole(check.viewerSeat, 1, capacity);
    const target = whole(check.targetSeat, 1, capacity);
    if (quest == null || viewerSeat == null || target == null || (check.side !== "good" && check.side !== "evil")) return null;
    checks.push({ quest, viewerSeat, targetSeat: target, side: check.side });
  }
  return {
    v: 1,
    capacity,
    players,
    members,
    proposals,
    quests,
    cards,
    result: {
      winner: result.winner,
      reason: result.reason as GameResult["reason"],
      ...(targetSeat !== undefined ? { targetSeat } : {}),
      ...(result.early === true ? { early: true } : {}),
    },
    checks,
  };
}

/** The recap this account is allowed to see. Other players' lake results stay out. */
export function publicReplay(stored: StoredReplay, accountId: string): PublicReplay | null {
  const meSeat = stored.members.find(member => member.accountId === accountId)?.seat;
  if (!meSeat) return null;
  return {
    meSeat,
    capacity: stored.capacity,
    players: stored.players,
    proposals: stored.proposals,
    quests: stored.quests,
    cards: stored.cards,
    result: stored.result,
    checks: stored.checks.filter(check => check.viewerSeat === meSeat).map(({ quest, targetSeat, side }) => ({ quest, targetSeat, side })),
  };
}

export function replayGame(replay: PublicReplay): GameView {
  const quest = replay.quests.at(-1)?.quest ?? replay.proposals.at(-1)?.quest ?? 1;
  const room = { capacity: replay.capacity } as Room;
  return {
    quest,
    leaderSeat: replay.proposals.at(-1)?.leaderSeat ?? 1,
    rejections: 0,
    teamSize: teamSize(room, quest),
    failsRequired: failsRequired(room, quest),
    turnId: "replay",
    team: [],
    votedSeats: [],
    myTeamVote: null,
    submittedQuestCount: 0,
    myQuestVote: null,
    allowedQuestCards: [],
    proposals: replay.proposals.map((proposal, index) => ({ ...proposal, id: `p${index}` })),
    quests: replay.quests,
    result: replay.result,
    lake: { holderSeat: 0, usedSeats: [], pending: false, myChecks: replay.checks },
    publicReveals: [],
    loyalty: null,
    lancelotsSwitched: false,
    draftTeam: [],
    speech: null,
    revealedRoles: replay.players.map(player => ({ seat: player.seat, role: player.role })),
    questCards: replay.cards,
    mvp: null,
  };
}
