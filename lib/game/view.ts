import {
  DEFAULT_SPEECH_SECONDS, TAKEOVER_WAIT_MS, activeTakeovers, allowedQuestCards, failsRequired, identityFor,
  lancelotsSwitched, roomRoles, sameSecret, speakingOrder, teamSize,
} from "./model.ts";
import type { GameView, Player, Role, Room, RoomView } from "./model.ts";

/**
 * `me` is null for the shared big screen (v1.10): only what the whole table
 * sees — no ballots of its own, no lake results, and no roles or card owners
 * even after the game, since the screen is not a member of the game.
 */
function gameView(room: Room, me: Player | null): GameView | null {
  const game = room.game;
  if (!game) return null;
  // Explicitly project every field: the complete GameState must never reach a client.
  return {
    quest: game.quest,
    leaderSeat: game.leaderSeat,
    rejections: game.rejections,
    teamSize: teamSize(room, game.quest),
    failsRequired: failsRequired(room, game.quest),
    turnId: game.turnId,
    team: [...game.team],
    votedSeats: Object.keys(game.teamVotes).map(Number).sort((a, b) => a - b),
    myTeamVote: me ? game.teamVotes[me.seat] ?? null : null,
    submittedQuestCount: Object.keys(game.questVotes).length,
    myQuestVote: me && room.phase === "quest" ? game.questVotes[me.seat] ?? null : null,
    allowedQuestCards: me ? allowedQuestCards(room, me, game.quest) : [],
    proposals: game.proposals.map(proposal => ({
      id: proposal.id,
      quest: proposal.quest,
      attempt: proposal.attempt,
      leaderSeat: proposal.leaderSeat,
      team: [...proposal.team],
      votes: proposal.votes.map(({ seat, approve }) => ({ seat, approve })),
      approved: proposal.approved,
    })),
    quests: game.quests.map(({ quest, team, failCount, success }) => ({
      quest, team: [...team], failCount, success,
    })),
    result: game.result ? {
      winner: game.result.winner,
      reason: game.result.reason,
      ...(game.result.targetSeat !== undefined ? { targetSeat: game.result.targetSeat } : {}),
      ...(game.result.early ? { early: true } : {}),
    } : null,
    lake: game.lake ? {
      holderSeat: game.lake.holderSeat,
      usedSeats: [...game.lake.usedSeats],
      pending: game.lake.pending,
      myChecks: game.lake.checks.filter(check => !!me && check.viewerSeat === me.seat)
        .map(({ quest, targetSeat, side }) => ({ quest, targetSeat, side })),
    } : null,
    publicReveals: (game.publicReveals ?? []).map(({ seat, role }) => ({ seat, role })),
    loyalty: game.loyalty ? [...game.loyalty] : null,
    lancelotsSwitched: lancelotsSwitched(game, game.quest),
    draftTeam: room.phase === "team" ? [...(game.draftTeam ?? [])] : [],
    speech: room.phase === "team" && game.speech?.turnId === game.turnId ? {
      order: speakingOrder(room, game.leaderSeat),
      index: game.speech.index,
      startedAt: game.speech.startedAt,
      seconds: game.speechSeconds ?? DEFAULT_SPEECH_SECONDS,
      now: Date.now(),
    } : null,
    revealedRoles: me && room.phase === "finished"
      ? room.players.filter((player): player is Player & { role: Role } => !!player.role)
        .map(({ seat, role }) => ({ seat, role })).sort((a, b) => a.seat - b.seat)
      : null,
    // Receipts and results are appended together when a quest resolves, so
    // they line up one to one.
    questCards: me && room.phase === "finished"
      ? game.quests.map((quest, index) => ({
        quest: quest.quest,
        cards: (game.questReceipts[index]?.votes ?? []).map(({ seat, card }) => ({ seat, card })).sort((a, b) => a.seat - b.seat),
      }))
      : null,
  };
}

export function roomView(room: Room, key: string, version: number, invite?: string | null, screen = false): RoomView {
  const me = room.players.find(player => player.key === key);
  const isHost = !!me && me.id === room.hostId;
  // Legacy rooms (no token) keep their previous behaviour for their last hours.
  const invited = !room.inviteToken || (typeof invite === "string" && sameSecret(invite, room.inviteToken));
  const namesHidden = !me && !invited;
  const takeovers = activeTakeovers(room);
  const mine = me ? undefined : takeovers.find(request => request.key === key);
  return {
    code: room.code,
    round: room.round ?? 1,
    capacity: room.capacity,
    preset: room.preset,
    roles: roomRoles(room),
    ladyOfLake: room.ladyOfLake === true,
    turnSpeech: room.turnSpeech !== false,
    phase: room.phase,
    hostId: room.hostId,
    hostRevision: room.hostRevision ?? 0,
    resetReason: room.resetReason ?? null,
    version,
    players: room.players.map(({ id, name, seat, ready, confirmed }) => ({
      id, name: namesHidden ? "" : name, seat, ready, confirmed,
    })).sort((a, b) => a.seat - b.seat),
    meId: me?.id ?? null,
    identity: me && !screen ? identityFor(room, me) : null,
    expiresAt: room.expiresAt,
    firstLeader: room.firstLeader ?? null,
    // The big screen (v1.10) always gets the public projection, even on a
    // member's device; a device without a seat needs the room's invite token.
    game: screen ? (me || (room.inviteToken && invited) ? gameView(room, null) : null) : me ? gameView(room, me) : null,
    namesHidden,
    inviteToken: me ? room.inviteToken ?? null : null,
    recoveryCode: me?.recovery ?? null,
    takeoverRequests: isHost ? takeovers.map(({ id, seat, createdAt, verifyCode }) => ({
      id, seat, createdAt, approvableAt: createdAt + TAKEOVER_WAIT_MS, verifyCode,
      name: room.players.find(player => player.seat === seat)?.name ?? "",
    })).sort((a, b) => a.createdAt - b.createdAt) : [],
    myTakeover: mine ? { id: mine.id, seat: mine.seat, createdAt: mine.createdAt, approvableAt: mine.createdAt + TAKEOVER_WAIT_MS, verifyCode: mine.verifyCode } : null,
    takeoversOfMySeat: me ? takeovers.filter(request => request.playerId === me.id)
      .map(({ id, createdAt, verifyCode }) => ({ id, createdAt, approvableAt: createdAt + TAKEOVER_WAIT_MS, verifyCode })) : [],
    recoveries: (room.recoveries ?? []).map(({ seat, method, at }) => ({ seat, method, at })),
    history: me ? (room.history ?? []).filter(record => record.players.some(player => player.id === me.id))
      .map(({ round, winner, reason, players }) => ({ round, winner, reason, players: players.map(({ id, name, seat, role, side }) => ({ id, name, seat, role, side })) })) : [],
    seatSwapOut: !screen && me ? ((room.seatSwaps ?? []).flatMap(request => {
      if (request.fromId !== me.id) return [];
      const target = room.players.find(player => player.id === request.toId);
      return target ? [{ id: request.id, seat: request.toSeat, name: target.name }] : [];
    })[0] ?? null) : null,
    seatSwapIn: !screen && me ? (room.seatSwaps ?? []).flatMap(request => {
      if (request.toId !== me.id) return [];
      const from = room.players.find(player => player.id === request.fromId);
      return from ? [{ id: request.id, fromSeat: from.seat, name: from.name, seat: request.toSeat }] : [];
    }) : [],
  };
}
