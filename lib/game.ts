export type Role = "merlin" | "percival" | "loyal" | "assassin" | "morgana" | "mordred" | "oberon" | "minion";
export type Preset = "classic" | "basic" | "mist" | "full";
export const ROLES: Record<Role, { name: string; side: "good" | "evil"; description: string }> = {
  merlin: { name: "梅林", side: "good", description: "引导好人完成任务，同时隐藏自己。三次任务成功后，仍要躲过刺客的刺杀。" },
  percival: { name: "派西维尔", side: "good", description: "你看见梅林的候选人，但莫甘娜也可能混在其中。保护真正的梅林。" },
  loyal: { name: "亚瑟的忠臣", side: "good", description: "你没有额外的身份线索。通过讨论与投票，找到值得信任的同伴。" },
  assassin: { name: "刺客", side: "evil", description: "隐藏在队伍中阻挠任务。好人完成三次任务后，你有一次刺杀梅林的机会。" },
  morgana: { name: "莫甘娜", side: "evil", description: "在派西维尔眼中，你与梅林无法区分。利用这一点隐藏自己。" },
  mordred: { name: "莫德雷德", side: "evil", description: "梅林无法看见你的邪恶身份，但其他邪恶同伴认识你（奥伯伦除外）。" },
  oberon: { name: "奥伯伦", side: "evil", description: "你与其他邪恶同伴互不相识，但梅林能看见你的邪恶身份。" },
  minion: { name: "莫德雷德的爪牙", side: "evil", description: "与邪恶同伴合作，让任务失败，并保护刺客找到梅林。" },
};
export const PRESETS: Record<Preset, { name: string; hint: string; minimum: number }> = {
  classic: { name: "经典局", hint: "梅林、派西维尔、莫甘娜、刺客", minimum: 5 },
  basic: { name: "基础局", hint: "梅林、刺客，适合初次入局", minimum: 5 },
  mist: { name: "迷雾局", hint: "经典局加入莫德雷德 · 7 人起", minimum: 7 },
  full: { name: "全角色局", hint: "加入莫德雷德与奥伯伦 · 10 人", minimum: 10 },
};
export const EVIL_COUNTS: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
export function rolePool(capacity: number, preset: Preset): Role[] {
  if (!Number.isInteger(capacity) || !(capacity in EVIL_COUNTS) ||
      !Object.hasOwn(PRESETS, preset) || capacity < PRESETS[preset].minimum) {
    throw new GameError("人数或角色配置无效。", 400);
  }
  const good: Role[] = ["merlin"], evil: Role[] = ["assassin"];
  if (preset !== "basic") {
    good.push("percival");
    evil.push("morgana");
  }
  if (preset === "mist" || preset === "full") evil.push("mordred");
  if (preset === "full") evil.push("oberon");
  while (good.length < capacity - EVIL_COUNTS[capacity]) good.push("loyal");
  while (evil.length < EVIL_COUNTS[capacity]) evil.push("minion");
  return [...good, ...evil];
}
export class GameError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export interface Player {
  id: string;
  key: string;
  name: string;
  seat: number;
  ready: boolean;
  confirmed: boolean;
  role?: Role;
}
export type RoomPhase = "lobby" | "identity" | "ready" | "team" | "vote" | "quest" | "assassination" | "finished" | "closed";
export type QuestCard = "success" | "fail";
export interface TeamProposal {
  id: string;
  quest: number;
  attempt: number;
  leaderSeat: number;
  team: number[];
  votes: { seat: number; approve: boolean }[];
  approved: boolean;
}
export interface QuestResult {
  quest: number;
  team: number[];
  failCount: number;
  success: boolean;
}
export interface GameResult {
  winner: "good" | "evil";
  reason: "three-failures" | "five-rejections" | "merlin-assassinated" | "assassin-missed";
  targetSeat?: number;
}
interface GameState {
  quest: number;
  leaderSeat: number;
  rejections: number;
  turnId: string;
  team: number[];
  teamVotes: Record<number, boolean>;
  questVotes: Record<number, QuestCard>;
  proposals: TeamProposal[];
  quests: QuestResult[];
  result: GameResult | null;
  // These receipts are server-only. At most five missions can finish in a game.
  // Keeping them makes the last submitted card safe to retry after a transition.
  questReceipts: { turnId: string; votes: { seat: number; card: QuestCard }[] }[];
}
export interface GameView {
  quest: number;
  leaderSeat: number;
  rejections: number;
  teamSize: number;
  failsRequired: number;
  turnId: string;
  team: number[];
  votedSeats: number[];
  myTeamVote: boolean | null;
  submittedQuestCount: number;
  myQuestVote: QuestCard | null;
  proposals: TeamProposal[];
  quests: QuestResult[];
  result: GameResult | null;
  revealedRoles: { seat: number; role: Role }[] | null;
}
export interface Room {
  code: string;
  capacity: number;
  preset: Preset;
  phase: RoomPhase;
  hostId: string;
  players: Player[];
  createdAt: number;
  expiresAt: number;
  requestId: string;
  firstLeader?: number;
  game?: GameState;
}
export interface Identity {
  role: Role;
  side: "good" | "evil";
  known: { seat: number; name: string; label: string }[];
  note: string;
}
export interface RoomView {
  code: string;
  capacity: number;
  preset: Preset;
  phase: RoomPhase;
  hostId: string;
  version: number;
  players: { id: string; name: string; seat: number; ready: boolean; confirmed: boolean }[];
  meId: string | null;
  identity: Identity | null;
  expiresAt: number;
  firstLeader: number | null;
  game: GameView | null;
}

export function randomInt(max: number): number {
  const boundary = Math.floor(4294967296 / max) * max;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= boundary);
  return data[0] % max;
}

export function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function nickname(value: unknown): string {
  if (typeof value !== "string") throw new GameError("请填写昵称。", 400);
  const name = value.trim().normalize("NFC");
  if (!name || [...name].length > 12 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new GameError("昵称需为 1–12 个可见字符。", 400);
  }
  return name;
}

export function identityFor(room: Room, me: Player): Identity | null {
  if (!me.role || room.phase === "lobby" || room.phase === "closed") return null;
  let known: Identity["known"] = [];
  let note = "你没有额外的身份线索。";
  if (me.role === "merlin") {
    known = room.players
      .filter(player => player.role && ROLES[player.role].side === "evil" && player.role !== "mordred")
      .map(player => ({ seat: player.seat, name: player.name, label: "已知邪恶" }));
    note = "这些座位属于邪恶阵营；如果本局有莫德雷德，他不会出现在这里。";
  } else if (me.role === "percival") {
    known = room.players.filter(player => player.role === "merlin" || player.role === "morgana")
      .map(player => ({ seat: player.seat, name: player.name, label: "梅林候选" }));
    note = "这些人中有梅林；如果本局有莫甘娜，她也会出现在这里。你无法直接区分。";
  } else if (ROLES[me.role].side === "evil" && me.role !== "oberon") {
    known = room.players.filter(player => player.id !== me.id && player.role &&
      ROLES[player.role].side === "evil" && player.role !== "oberon")
      .map(player => ({ seat: player.seat, name: player.name, label: "邪恶同伴" }));
    note = "你们同属邪恶阵营。奥伯伦不会出现，你也无法获知同伴的具体角色。";
  } else if (me.role === "oberon") {
    note = "你不知道其他邪恶同伴是谁，他们也不认识你。梅林能看见你。";
  }
  return { role: me.role, side: ROLES[me.role].side, known: known.sort((a, b) => a.seat - b.seat), note };
}
const TEAM_SIZES: Record<number, readonly number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

function teamSize(room: Room, quest: number): number {
  const size = TEAM_SIZES[room.capacity]?.[quest - 1];
  if (!size) throw new GameError("任务配置无效，请重新建立房间。", 400);
  return size;
}

function failsRequired(room: Room, quest: number): number {
  return room.capacity >= 7 && quest === 4 ? 2 : 1;
}

function gameView(room: Room, me: Player): GameView | null {
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
    myTeamVote: game.teamVotes[me.seat] ?? null,
    submittedQuestCount: Object.keys(game.questVotes).length,
    myQuestVote: room.phase === "quest" ? game.questVotes[me.seat] ?? null : null,
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
    } : null,
    revealedRoles: room.phase === "finished"
      ? room.players.filter((player): player is Player & { role: Role } => !!player.role)
        .map(({ seat, role }) => ({ seat, role })).sort((a, b) => a.seat - b.seat)
      : null,
  };
}

export function roomView(room: Room, key: string, version: number): RoomView {
  const me = room.players.find(player => player.key === key);
  return {
    code: room.code,
    capacity: room.capacity,
    preset: room.preset,
    phase: room.phase,
    hostId: room.hostId,
    version,
    players: room.players.map(({ id, name, seat, ready, confirmed }) => ({
      id, name, seat, ready, confirmed,
    })).sort((a, b) => a.seat - b.seat),
    meId: me?.id ?? null,
    identity: me ? identityFor(room, me) : null,
    expiresAt: room.expiresAt,
    firstLeader: room.firstLeader ?? null,
    game: me ? gameView(room, me) : null,
  };
}

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
  game.team = [];
  game.teamVotes = {};
  game.questVotes = {};
  room.phase = "team";
}

function finishGame(room: Room, game: GameState, result: GameResult): void {
  game.result = result;
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
  };
  room.phase = "team";
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
  if (!me.role || (ROLES[me.role].side === "good" && card === "fail")) {
    throw new GameError("好人阵营只能提交成功牌。", 403);
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
  if (game.quests.filter(quest => !quest.success).length === 3) {
    finishGame(room, game, { winner: "evil", reason: "three-failures" });
  } else if (game.quests.filter(quest => quest.success).length === 3) {
    game.turnId = crypto.randomUUID();
    game.team = [];
    game.teamVotes = {};
    room.phase = "assassination";
  } else {
    game.quest += 1;
    newTeamTurn(room, game);
  }
}

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
  requireCurrentTurn(room, game, turnId, "assassination");
  // Resolve the one allowed choice without revealing hidden factions through errors.
  const foundMerlin = room.players.find(player => player.seat === targetSeat)?.role === "merlin";
  finishGame(room, game, {
    winner: foundMerlin ? "evil" : "good",
    reason: foundMerlin ? "merlin-assassinated" : "assassin-missed",
    targetSeat,
  });
}

function gameAction(room: Room, me: Player, action: string, input: Record<string, unknown>): void {
  if (action === "begin") {
    beginGame(room, me);
    return;
  }
  const game = room.game;
  if (!game) throw new GameError("请先确认身份并开始任务。 ");
  if (action === "propose") proposeTeam(room, game, me, input);
  else if (action === "vote") voteOnTeam(room, game, me, input);
  else if (action === "quest") submitQuest(room, game, me, input);
  else if (action === "assassinate") assassinate(room, game, me, input);
}
export function mutateRoom(room: Room, key: string, action: string, input: Record<string, unknown>): void {
  const me = room.players.find(player => player.key === key);
  if (action === "join") {
    if (me) return;
    if (room.phase !== "lobby") throw new GameError("房间已发身份，不能中途加入。", 403);
    const name = nickname(input.name), seat = Number(input.seat);
    if (!Number.isInteger(seat) || seat < 1 || seat > room.capacity) {
      throw new GameError("请选择有效的座位。", 400);
    }
    if (room.players.some(player => player.seat === seat)) throw new GameError("这个座位刚被占用，请换一个。 ");
    if (room.players.length >= room.capacity) throw new GameError("房间已满。 ");
    room.players.push({ id: crypto.randomUUID(), key, name, seat, ready: false, confirmed: false });
    return;
  }
  if (!me) throw new GameError("请先加入房间。", 403);
  if (["begin", "propose", "vote", "quest", "assassinate"].includes(action)) {
    gameAction(room, me, action, input);
    return;
  }
  if (action === "confirm") {
    // A delayed confirmation after begin must not move the game back to ready.
    if (me.confirmed && room.phase !== "lobby" && room.phase !== "closed") return;
    if (room.phase !== "identity" && room.phase !== "ready") throw new GameError("还没有发身份。 ");
    me.confirmed = true;
    if (room.players.every(player => player.confirmed)) room.phase = "ready";
    return;
  }
  if (action === "start" && room.phase !== "lobby") {
    if (room.hostId !== me.id) throw new GameError("只有房主可以发身份。", 403);
    return; // A retry must never reshuffle assigned identities.
  }
  if (room.phase !== "lobby") throw new GameError("发身份后，座位与配置已锁定。 ");
  if (action === "ready") {
    if (typeof input.ready !== "boolean") throw new GameError("准备状态无效。", 400);
    me.ready = input.ready;
    return;
  }
  if (action === "seat") {
    const seat = Number(input.seat);
    if (!Number.isInteger(seat) || seat < 1 || seat > room.capacity) {
      throw new GameError("请选择有效的座位。", 400);
    }
    if (room.players.some(player => player.id !== me.id && player.seat === seat)) {
      throw new GameError("这个座位已被占用。 ");
    }
    me.seat = seat;
    me.ready = false;
    return;
  }
  if (action === "leave") {
    room.players = room.players.filter(player => player.id !== me.id);
    if (!room.players.length) {
      room.phase = "closed";
      return;
    }
    if (room.hostId === me.id) {
      room.hostId = [...room.players].sort((a, b) => a.seat - b.seat)[0].id;
    }
    return;
  }
  if (action === "start") {
    if (room.hostId !== me.id) throw new GameError("只有房主可以发身份。", 403);
    if (room.players.length !== room.capacity || !room.players.every(player => player.ready)) {
      throw new GameError("请等待所有座位坐满，并且全员准备。 ");
    }
    const roles = shuffle(rolePool(room.capacity, room.preset));
    room.players.forEach((player, index) => {
      player.role = roles[index];
      player.confirmed = false;
    });
    room.firstLeader = randomInt(room.capacity) + 1;
    room.phase = "identity";
    return;
  }
  throw new GameError("不支持这个操作。", 400);
}
