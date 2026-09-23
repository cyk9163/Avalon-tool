import {
  SPEECH_SECONDS, GameError, LANCELOTS, MAX_HISTORY, allowedQuestCards, currentSide, failsRequired,
  randomInt, shuffle, speakingOrder, teamSize,
} from "./model.ts";
import type { GameResult, GameState, LoyaltyCard, Player, Room, RoomPhase } from "./model.ts";

function requireTurnId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 64) {
    throw new GameError("回合编号无效，请刷新后重试。", 400);
  }
  return value;
}

function requireCurrentTurn(room: Room, game: GameState, turnId: string, phase: RoomPhase): void {
  if (turnId !== game.turnId || room.phase !== phase) {
    throw new GameError("这一步已结束，请查看最新进度。 ");
  }
}

function readTeam(room: Room, value: unknown): number[] {
  if (!Array.isArray(value) || value.length > room.capacity || value.some(seat =>
    typeof seat !== "number" || !Number.isInteger(seat) || seat < 1 || seat > room.capacity
  ) || new Set(value).size !== value.length) {
    throw new GameError("请选择有效且不重复的座位。", 400);
  }
  return [...value].sort((a, b) => a - b);
}

function sameTeam(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((seat, index) => seat === b[index]);
}

function newTeamTurn(room: Room, game: GameState): void {
  game.leaderSeat = game.leaderSeat % room.capacity + 1;
  game.turnId = crypto.randomUUID();
  delete game.draftTeam;
  game.speech = { turnId: game.turnId, index: 0, startedAt: Date.now() };
  game.team = [];
  game.teamVotes = {};
  game.questVotes = {};
  room.phase = "team";
}

function finishGame(room: Room, game: GameState, result: GameResult): void {
  game.result = result;
  const round = room.round ?? 1;
  if (!(room.history ?? []).some(record => record.round === round)) {
    room.history = [...(room.history ?? []), {
      round, winner: result.winner, reason: result.reason,
      players: room.players.filter(player => player.role).map(player => ({
        id: player.id, name: player.name, seat: player.seat, role: player.role!, side: currentSide(room, player),
      })).sort((a, b) => a.seat - b.seat),
    }].slice(-MAX_HISTORY);
  }
  game.teamVotes = {};
  game.questVotes = {};
  room.phase = "finished";
}

function beginGame(room: Room, me: Player): void {
  if (room.hostId !== me.id) throw new GameError("只有房主可以开始任务。", 403);
  if (room.game) return; // Retrying the launch must never reset an ongoing game.
  if (room.phase !== "ready" || room.players.length !== room.capacity ||
      !room.players.every(player => player.confirmed && player.role)) {
    throw new GameError("请等待所有人确认身份。 ");
  }
  // Older stage-one rooms already have firstLeader but do not have a game object.
  room.firstLeader ??= randomInt(room.capacity) + 1;
  room.game = {
    quest: 1,
    leaderSeat: room.firstLeader,
    rejections: 0,
    turnId: crypto.randomUUID(),
    team: [],
    teamVotes: {},
    questVotes: {},
    proposals: [],
    quests: [],
    result: null,
    questReceipts: [],
    ...(room.ladyOfLake ? { lake: { holderSeat: room.firstLeader % room.capacity + 1, usedSeats: [], pending: false, checks: [] } } : {}),
    publicReveals: [],
    ...(room.players.some(player => player.role === "goodLancelot") ? { loyalty: shuffle<LoyaltyCard>(["keep", "keep", "keep", "switch", "switch"]).slice(0, 3) } : {}),
  };
  room.game.speech = { turnId: room.game.turnId, index: 0, startedAt: Date.now() };
  room.phase = "team";
}

/**
 * Speaking turns (v1.8). "next" passes the floor on (the speaker, the leader
 * or the host may do it, so an absent player can be skipped); "restart" lets
 * the leader or host start a new round of talk; "timer" sets the soft timer.
 * `index` makes a repeated "next" harmless.
 */
function speech(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  requireCurrentTurn(room, game, turnId, "team");
  const chair = me.seat === game.leaderSeat || me.id === room.hostId;
  const state = game.speech?.turnId === turnId ? game.speech : { turnId, index: 0, startedAt: Date.now() };
  if (input.step === "next") {
    if (typeof input.index !== "number" || !Number.isInteger(input.index)) throw new GameError("发言进度无效，请刷新后重试。", 400);
    if (input.index < state.index) return; // Already passed on.
    if (input.index !== state.index || state.index >= room.capacity) throw new GameError("这一步已结束，请查看最新进度。 ");
    const speaker = speakingOrder(room, game.leaderSeat)[state.index];
    if (me.seat !== speaker && !chair) throw new GameError("只有正在发言的玩家、队长或房主可以轮到下一位。", 403);
    game.speech = { turnId, index: state.index + 1, startedAt: Date.now() };
  } else if (input.step === "restart") {
    if (!chair) throw new GameError("只有队长或房主可以重新开始发言。", 403);
    game.speech = { turnId, index: 0, startedAt: Date.now() };
  } else if (input.step === "timer") {
    if (!chair) throw new GameError("只有队长或房主可以设置发言计时。", 403);
    if (!SPEECH_SECONDS.includes(input.seconds as never)) throw new GameError("请选择有效的发言时间。", 400);
    game.speechSeconds = input.seconds as number;
    game.speech = { ...state, startedAt: Date.now() };
  } else {
    throw new GameError("未知的发言操作。", 400);
  }
}

/** The leader shows (or changes, or clears) a team for discussion before calling the vote. */
function draftTeam(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  if (me.seat !== game.leaderSeat) throw new GameError("只有本轮队长可以亮车。", 403);
  requireCurrentTurn(room, game, turnId, "team");
  const team = readTeam(room, input.team);
  if (team.length > teamSize(room, game.quest)) throw new GameError(`本次任务需要选择 ${teamSize(room, game.quest)} 人。`, 400);
  if (team.length) game.draftTeam = team;
  else delete game.draftTeam;
}

function proposeTeam(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  const team = readTeam(room, input.team);
  const previous = game.proposals.find(proposal => proposal.id === turnId);
  if (previous) {
    if (previous.leaderSeat !== me.seat) throw new GameError("只有本轮队长可以提议队伍。", 403);
    if (!sameTeam(previous.team, team)) throw new GameError("已提交的队伍不能修改。 ");
    return;
  }
  if (turnId !== game.turnId) throw new GameError("这一步已结束，请查看最新进度。 ");
  if (me.seat !== game.leaderSeat) throw new GameError("只有本轮队长可以提议队伍。", 403);
  if ((room.phase === "vote" || room.phase === "quest") && sameTeam(game.team, team)) return;
  requireCurrentTurn(room, game, turnId, "team");
  if (team.length !== teamSize(room, game.quest)) {
    throw new GameError(`本次任务需要选择 ${teamSize(room, game.quest)} 人。`, 400);
  }
  delete game.draftTeam;
  game.team = team;
  room.phase = "vote";
}

function voteOnTeam(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  if (typeof input.approve !== "boolean") throw new GameError("请选择赞成或反对。", 400);
  const approve = input.approve;
  const previous = game.proposals.find(proposal => proposal.id === turnId);
  if (previous) {
    const vote = previous.votes.find(vote => vote.seat === me.seat);
    if (!vote || vote.approve !== approve) throw new GameError("已提交的表决不能修改。 ");
    return;
  }
  requireCurrentTurn(room, game, turnId, "vote");
  if (Object.hasOwn(game.teamVotes, me.seat)) {
    if (game.teamVotes[me.seat] !== approve) throw new GameError("已提交的表决不能修改。 ");
    return;
  }
  game.teamVotes[me.seat] = approve;
  if (!room.players.every(player => Object.hasOwn(game.teamVotes, player.seat))) return;

  const votes = room.players.map(player => ({
    seat: player.seat, approve: game.teamVotes[player.seat],
  })).sort((a, b) => a.seat - b.seat);
  const approved = votes.filter(vote => vote.approve).length > room.capacity / 2;
  // A legal game has at most five attempts per mission and at most five missions.
  game.proposals.push({
    id: game.turnId,
    quest: game.quest,
    attempt: game.rejections + 1,
    leaderSeat: game.leaderSeat,
    team: [...game.team],
    votes,
    approved,
  });
  if (approved) {
    game.rejections = 0;
    room.phase = "quest";
    return;
  }
  game.rejections += 1;
  if (game.rejections === 5) {
    finishGame(room, game, { winner: "evil", reason: "five-rejections" });
  } else {
    newTeamTurn(room, game);
  }
}

function submitQuest(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  if (input.card !== "success" && input.card !== "fail") {
    throw new GameError("请选择有效的任务牌。", 400);
  }
  const card = input.card;
  const previous = game.questReceipts.find(receipt => receipt.turnId === turnId);
  if (previous) {
    const vote = previous.votes.find(vote => vote.seat === me.seat);
    if (!vote) throw new GameError("只有任务队员可以提交任务牌。", 403);
    if (vote.card !== card) throw new GameError("已提交的任务牌不能修改。 ");
    return;
  }
  requireCurrentTurn(room, game, turnId, "quest");
  if (!game.team.includes(me.seat)) throw new GameError("只有任务队员可以提交任务牌。", 403);
  if (!allowedQuestCards(room, me, game.quest).includes(card)) {
    throw new GameError(me.role && LANCELOTS.includes(me.role) ? (currentSide(room, me) === "good" ? "兰斯洛特现在属于正义阵营，只能提交成功牌。" : "兰斯洛特现在属于邪恶阵营，只能提交失败牌。") : me.role === "lunatic" ? "疯子参加任务时必须提交失败牌。" : me.role === "brute" ? "野蛮人在第四、第五次任务只能提交成功牌。" : "好人阵营只能提交成功牌。", 403);
  }
  if (Object.hasOwn(game.questVotes, me.seat)) {
    if (game.questVotes[me.seat] !== card) throw new GameError("已提交的任务牌不能修改。 ");
    return;
  }
  game.questVotes[me.seat] = card;
  if (!game.team.every(seat => Object.hasOwn(game.questVotes, seat))) return;

  const failCount = game.team.filter(seat => game.questVotes[seat] === "fail").length;
  game.questReceipts.push({
    turnId,
    votes: game.team.map(seat => ({ seat, card: game.questVotes[seat] })),
  });
  game.quests.push({
    quest: game.quest,
    team: [...game.team],
    failCount,
    success: failCount < failsRequired(room, game.quest),
  });
  game.questVotes = {};
  game.rejections = 0;
  if (game.quests.filter(quest => !quest.success).length === 2) {
    const revealer = room.players.find(player => player.role === "revealer");
    if (revealer && !(game.publicReveals ?? []).some(item => item.seat === revealer.seat)) {
      (game.publicReveals ??= []).push({ seat: revealer.seat, role: "revealer" });
    }
  }
  if (game.quests.filter(quest => !quest.success).length === 3) {
    finishGame(room, game, { winner: "evil", reason: "three-failures" });
  } else if (game.quests.filter(quest => quest.success).length === 3) {
    game.turnId = crypto.randomUUID();
    game.team = [];
    game.teamVotes = {};
    room.phase = "assassination";
  } else if (game.lake && game.quest >= 2 && game.quest <= 4) {
    game.lake.pending = true;
    room.phase = "lake";
  } else {
    game.quest += 1;
    newTeamTurn(room, game);
  }
}

function checkLake(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  const turnId = requireTurnId(input.turnId);
  const targetSeat = Number(input.targetSeat);
  const prior = game.lake?.checks.find(check => check.turnId === turnId && check.viewerSeat === me.seat);
  if (prior) {
    if (prior.targetSeat !== targetSeat) throw new GameError("本次查验已经完成，不能更换目标。 ");
    return;
  }
  requireCurrentTurn(room, game, turnId, "lake");
  const lake = game.lake;
  if (!lake?.pending || lake.holderSeat !== me.seat) throw new GameError("只有当前湖中仙女持有者可以查验。", 403);
  if (!Number.isInteger(targetSeat) || targetSeat === me.seat || lake.usedSeats.includes(targetSeat)) {
    throw new GameError("请选择一位尚未使用过湖中仙女的其他玩家。", 400);
  }
  const target = room.players.find(player => player.seat === targetSeat);
  if (!target?.role) throw new GameError("查验目标无效。", 400);
  lake.checks.push({ turnId, quest: game.quest, viewerSeat: me.seat, targetSeat, side: currentSide(room, target) });
  lake.usedSeats.push(me.seat);
  lake.holderSeat = targetSeat;
  lake.pending = false;
  game.quest += 1;
  newTeamTurn(room, game);
}

const EARLY_STRIKE_PHASES: readonly RoomPhase[] = ["team", "vote", "quest", "lake"];

function assassinate(room: Room, game: GameState, me: Player, input: Record<string, unknown>): void {
  if (me.role !== "assassin") throw new GameError("只有刺客可以作出最终选择。", 403);
  const turnId = requireTurnId(input.turnId);
  const targetSeat = input.targetSeat;
  if (typeof targetSeat !== "number" || !Number.isInteger(targetSeat) || targetSeat === me.seat ||
      !room.players.some(player => player.seat === targetSeat)) {
    throw new GameError("请选择其他玩家作为刺杀目标。", 400);
  }
  if (room.phase === "finished" && game.turnId === turnId && game.result?.targetSeat !== undefined) {
    if (game.result.targetSeat !== targetSeat) throw new GameError("刺杀已结束，不能更换目标。 ");
    return;
  }
  // House rule: the assassin may strike during any step of play, on the
  // current turn only; the strike ends the game either way, so it can only
  // ever happen once. If nobody struck, three successes lead to the final step.
  const early = room.phase !== "assassination";
  if (early) {
    if (!EARLY_STRIKE_PHASES.includes(room.phase)) throw new GameError("现在还不能刺杀。");
    if (turnId !== game.turnId) throw new GameError("这一步已结束，请查看最新进度。 ");
  } else {
    requireCurrentTurn(room, game, turnId, "assassination");
  }
  // Resolve the one allowed choice without revealing hidden factions through errors.
  const foundMerlin = room.players.find(player => player.seat === targetSeat)?.role === "merlin";
  finishGame(room, game, {
    winner: foundMerlin ? "evil" : "good",
    reason: foundMerlin ? "merlin-assassinated" : "assassin-missed",
    targetSeat,
    ...(early ? { early: true } : {}),
  });
}

export function gameAction(room: Room, me: Player, action: string, input: Record<string, unknown>): void {
  if (action === "begin") {
    beginGame(room, me);
    return;
  }
  const game = room.game;
  if (!game) throw new GameError("请先确认身份并开始任务。 ");
  if (action === "propose") proposeTeam(room, game, me, input);
  else if (action === "draft") draftTeam(room, game, me, input);
  else if (action === "speech") speech(room, game, me, input);
  else if (action === "vote") voteOnTeam(room, game, me, input);
  else if (action === "quest") submitQuest(room, game, me, input);
  else if (action === "lake-check") checkLake(room, game, me, input);
  else if (action === "assassinate") assassinate(room, game, me, input);
}
