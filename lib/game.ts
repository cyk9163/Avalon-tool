export type Role = "merlin" | "percival" | "loyal" | "goodLancelot" | "cleric" |
  "assassin" | "morgana" | "mordred" | "oberon" | "evilLancelot" | "lunatic" | "brute" | "revealer" | "minion";
export type Preset = "classic" | "basic" | "mist" | "full" | "custom";
export const ROLES: Record<Role, { name: string; side: "good" | "evil"; description: string }> = {
  merlin: { name: "梅林", side: "good", description: "引导好人完成任务，同时隐藏自己。三次任务成功后，仍要躲过刺客的刺杀。" },
  percival: { name: "派西维尔", side: "good", description: "你看见梅林的候选人，但莫甘娜也可能混在其中。保护真正的梅林。" },
  loyal: { name: "亚瑟的忠臣", side: "good", description: "你没有额外的身份线索。通过讨论与投票，找到值得信任的同伴。" },
  goodLancelot: { name: "正义兰斯洛特", side: "good", description: "你开局属于正义阵营。第 3–5 轮若翻到「转换」忠诚牌，你会和邪恶兰斯洛特互换阵营。属于正义时只能出成功，属于邪恶时只能出失败。" },
  cleric: { name: "牧师", side: "good", description: "你知道第一任队长属于正义还是邪恶阵营。用这条线索判断开局风向。" },
  assassin: { name: "刺客", side: "evil", description: "隐藏在队伍中阻挠任务。对局中你可以随时出刀刺杀梅林，但只有一次；如果一直没出刀，好人完成三次任务后还有最后这一次机会。" },
  morgana: { name: "莫甘娜", side: "evil", description: "在派西维尔眼中，你与梅林无法区分。利用这一点隐藏自己。" },
  mordred: { name: "莫德雷德", side: "evil", description: "梅林无法看见你的邪恶身份，但其他邪恶同伴认识你（奥伯伦除外）。" },
  oberon: { name: "奥伯伦", side: "evil", description: "你与其他邪恶同伴互不相识，但梅林能看见你的邪恶身份。" },
  evilLancelot: { name: "邪恶兰斯洛特", side: "evil", description: "你开局属于邪恶阵营，认识除奥伯伦外的邪恶同伴。第 3–5 轮若翻到「转换」忠诚牌，你会和正义兰斯洛特互换阵营。属于邪恶时只能出失败，属于正义时只能出成功。" },
  lunatic: { name: "疯子", side: "evil", description: "只要参加任务，你必须提交失败牌。你的冲动可能让身份更容易暴露。" },
  brute: { name: "野蛮人", side: "evil", description: "前三次任务可以提交成功或失败牌；第四、第五次任务只能提交成功牌。" },
  revealer: { name: "揭露者", side: "evil", description: "第二次任务失败后，你的身份会向所有玩家公开。公开前仍可正常提交任务牌。" },
  minion: { name: "莫德雷德的爪牙", side: "evil", description: "与邪恶同伴合作，让任务失败，并保护刺客找到梅林。" },
};
export const PRESETS: Record<Preset, { name: string; hint: string; minimum: number }> = {
  classic: { name: "经典局", hint: "梅林、派西维尔、莫甘娜、刺客", minimum: 5 },
  basic: { name: "基础局", hint: "梅林、刺客，适合初次入局", minimum: 5 },
  mist: { name: "迷雾局", hint: "经典局加入莫德雷德 · 7 人起", minimum: 7 },
  full: { name: "全角色局", hint: "加入莫德雷德与奥伯伦 · 10 人", minimum: 10 },
  custom: { name: "自定义板子", hint: "自由选择官方角色与湖中仙女", minimum: 5 },
};
export const EVIL_COUNTS: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
export const CUSTOM_GOOD_ROLES: readonly Role[] = ["merlin", "percival", "goodLancelot", "cleric"];
export const CUSTOM_EVIL_ROLES: readonly Role[] = ["assassin", "morgana", "mordred", "oberon", "evilLancelot", "lunatic", "brute", "revealer"];
export function validateCustomRoles(capacity: number, input: unknown): Role[] {
  if (!Number.isInteger(capacity) || !(capacity in EVIL_COUNTS) || !Array.isArray(input) || input.length !== capacity ||
      input.some(role => typeof role !== "string" || !Object.hasOwn(ROLES, role))) {
    throw new GameError("自定义板子的角色数量或角色名称无效。", 400);
  }
  const roles = [...input] as Role[];
  const evilCount = roles.filter(role => ROLES[role].side === "evil").length;
  if (evilCount !== EVIL_COUNTS[capacity]) throw new GameError(`本局需要 ${capacity - EVIL_COUNTS[capacity]} 位正义与 ${EVIL_COUNTS[capacity]} 位邪恶角色。`, 400);
  for (const role of [...CUSTOM_GOOD_ROLES, ...CUSTOM_EVIL_ROLES]) {
    if (roles.filter(item => item === role).length > 1) throw new GameError(`${ROLES[role].name}只能加入一位。`, 400);
  }
  if (!roles.includes("merlin") || !roles.includes("assassin")) throw new GameError("当前对局流程需要保留梅林与刺客。", 400);
  if (roles.includes("morgana") && !roles.includes("percival")) throw new GameError("莫甘娜需要与派西维尔同时加入。", 400);
  if (roles.includes("goodLancelot") !== roles.includes("evilLancelot")) throw new GameError("正义与邪恶兰斯洛特必须成对加入。", 400);
  const expanded = roles.some(role => ["goodLancelot", "evilLancelot", "cleric", "lunatic", "brute", "revealer"].includes(role));
  if (expanded && capacity < 7) throw new GameError("扩展角色限定在 7 人及以上的自定义板子中。", 400);
  return roles;
}
export function rolePool(capacity: number, preset: Preset, customRoles?: unknown): Role[] {
  if (!Number.isInteger(capacity) || !(capacity in EVIL_COUNTS) ||
      !Object.hasOwn(PRESETS, preset) || capacity < PRESETS[preset].minimum) {
    throw new GameError("人数或角色配置无效。", 400);
  }
  if (preset === "custom") return validateCustomRoles(capacity, customRoles);
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
  // Server-only one-time code that moves this seat to a new device. Rooms
  // created before v0.8 have none. Rotated after every successful recovery.
  recovery?: string;
}
export interface TakeoverRequest {
  id: string;
  seat: number;
  playerId: string;
  // SHA-256 of the requesting device credential, like Player.key.
  key: string;
  createdAt: number;
  // Four digits shown on the requesting device, the host's list and the seat
  // owner's device, so the host can match the right phone face to face.
  verifyCode: string;
}
export interface RecoveryRecord {
  seat: number;
  method: "code" | "host";
  at: number;
  // Server-only receipt so a retried approval is idempotent.
  requestId?: string;
}
export type RoomPhase = "lobby" | "identity" | "ready" | "team" | "vote" | "quest" | "lake" | "assassination" | "finished" | "closed";
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
  // The assassin struck before three quests succeeded (anytime-assassin rule).
  early?: boolean;
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
  lake?: {
    holderSeat: number;
    usedSeats: number[];
    pending: boolean;
    checks: { turnId: string; quest: number; viewerSeat: number; targetSeat: number; side: "good" | "evil" }[];
  };
  publicReveals?: { seat: number; role: Role }[];
  // Lancelot loyalty cards for rounds 3, 4 and 5 (official variant 2: dealt
  // face up when the game starts, so everyone knows when the switches come).
  loyalty?: LoyaltyCard[];
}
export type LoyaltyCard = "keep" | "switch";
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
  allowedQuestCards: QuestCard[];
  proposals: TeamProposal[];
  quests: QuestResult[];
  result: GameResult | null;
  lake: { holderSeat: number; usedSeats: number[]; pending: boolean; myChecks: { quest: number; targetSeat: number; side: "good" | "evil" }[] } | null;
  publicReveals: { seat: number; role: Role }[];
  // Public Lancelot loyalty cards for rounds 3–5, and whether the Lancelots are currently swapped.
  loyalty: LoyaltyCard[] | null;
  lancelotsSwitched: boolean;
  revealedRoles: { seat: number; role: Role }[] | null;
  // Who played which quest card. Secret during play; after the game ends it is
  // shown to this game's members only, alongside the full role reveal (v1.5).
  questCards: { quest: number; cards: { seat: number; card: QuestCard }[] }[] | null;
}
export interface Room {
  code: string;
  // Older stored rooms omit this field and belong to their first game.
  round?: number;
  capacity: number;
  preset: Preset;
  customRoles?: Role[];
  ladyOfLake?: boolean;
  phase: RoomPhase;
  hostId: string;
  hostRevision?: number;
  resetReason?: "rematch" | "abort";
  // A private receipt allows the former host to retry a completed transfer.
  lastHostTransfer?: { fromId: string; toId: string; round: number; hostRevision: number };
  players: Player[];
  createdAt: number;
  expiresAt: number;
  requestId: string;
  firstLeader?: number;
  game?: GameState;
  // v2 rooms (v0.8+) carry an unguessable invite token and recovery codes.
  schemaVersion?: number;
  inviteToken?: string;
  takeovers?: TakeoverRequest[];
  recoveries?: RecoveryRecord[];
}
export const ROOM_SCHEMA_VERSION = 2;
export const TAKEOVER_TTL_MS = 15 * 60 * 1000;
// The seat owner's current device is warned and can object during this window;
// the host cannot approve before it ends. It prevents a host from silently
// moving another player's seat (and hidden role) to a device of their own.
export const TAKEOVER_WAIT_MS = 60 * 1000;
const MAX_TAKEOVERS = 8;
const MAX_TAKEOVERS_PER_SEAT = 3;
const MAX_RECOVERY_RECORDS = 20;
export interface Identity {
  role: Role;
  side: "good" | "evil";
  known: { seat: number; name: string; label: string }[];
  note: string;
}
export interface RoomView {
  code: string;
  round: number;
  capacity: number;
  preset: Preset;
  roles: Role[];
  ladyOfLake: boolean;
  phase: RoomPhase;
  hostId: string;
  hostRevision: number;
  resetReason: "rematch" | "abort" | null;
  version: number;
  players: { id: string; name: string; seat: number; ready: boolean; confirmed: boolean }[];
  meId: string | null;
  identity: Identity | null;
  expiresAt: number;
  firstLeader: number | null;
  game: GameView | null;
  // True when an outsider opened the room without the invite link: nicknames
  // are withheld so a guessed six-digit code reveals nothing personal.
  namesHidden: boolean;
  inviteToken: string | null;
  recoveryCode: string | null;
  takeoverRequests: { id: string; seat: number; name: string; createdAt: number; approvableAt: number; verifyCode: string }[];
  myTakeover: { id: string; seat: number; createdAt: number; approvableAt: number; verifyCode: string } | null;
  // Requests to move *my* seat to another device: shown so I can object.
  takeoversOfMySeat: { id: string; createdAt: number; approvableAt: number; verifyCode: string }[];
  recoveries: { seat: number; method: "code" | "host"; at: number }[];
}

export function randomInt(max: number): number {
  const boundary = Math.floor(4294967296 / max) * max;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= boundary);
  return data[0] % max;
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Ten characters from a 32-symbol alphabet (50 bits), formatted XXXXX-XXXXX. */
export function newRecoveryCode(): string {
  const chars = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}
export function normalizeRecoveryCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 32) return null;
  const compact = value.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[2-9A-HJ-NP-Z]{10}$/.test(compact)) return null;
  return `${compact.slice(0, 5)}-${compact.slice(5)}`;
}
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Compares two secrets without an early exit on the first differing character. */
export function sameSecret(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
function activeTakeovers(room: Room, now = Date.now()): TakeoverRequest[] {
  // A request lapses when it expires, or when that player left or changed seat.
  return (room.takeovers ?? []).filter(request => now - request.createdAt < TAKEOVER_TTL_MS &&
    room.players.some(player => player.id === request.playerId && player.seat === request.seat));
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
  } else if (me.role === "goodLancelot") {
    note = "你不知道邪恶兰斯洛特是谁。忠诚牌翻到「转换」时，你会换到邪恶阵营，那时只能出失败牌。";
  } else if (me.role === "evilLancelot") {
    known = room.players.filter(player => player.id !== me.id && player.role &&
      ROLES[player.role].side === "evil" && player.role !== "oberon")
      .map(player => ({ seat: player.seat, name: player.name, label: ROLES[player.role!].name }));
    note = "你认识除奥伯伦外的邪恶同伴，他们也知道你；你不知道正义兰斯洛特是谁。忠诚牌翻到「转换」时，你会换到正义阵营，那时只能出成功牌。";
  } else if (me.role === "cleric") {
    const leader = room.players.find(player => player.seat === room.firstLeader);
    if (leader?.role) known = [{ seat: leader.seat, name: leader.name, label: ROLES[leader.role].side === "good" ? "第一任队长是正义" : "第一任队长是邪恶" }];
    note = "你只知道第一任队长的阵营，不知道其具体角色。";
  } else if (ROLES[me.role].side === "evil" && me.role !== "oberon") {
    known = room.players.filter(player => player.id !== me.id && player.role &&
      ROLES[player.role].side === "evil" && player.role !== "oberon")
      .map(player => ({ seat: player.seat, name: player.name, label: ROLES[player.role!].name }));
    note = "你们同属邪恶阵营，彼此知道对方的具体角色。奥伯伦不会出现在这里，他也不认识你们。";
  } else if (me.role === "oberon") {
    note = "你不知道其他邪恶同伴是谁，他们也不认识你。梅林能看见你。";
  }
  return { role: me.role, side: currentSide(room, me), known: known.sort((a, b) => a.seat - b.seat), note };
}

export function roomRoles(room: Pick<Room, "capacity" | "preset" | "customRoles">): Role[] {
  return rolePool(room.capacity, room.preset, room.customRoles);
}

const LANCELOTS: readonly Role[] = ["goodLancelot", "evilLancelot"];
/** Whether the Lancelots have swapped sides by this round (an odd number of switch cards so far). */
export function lancelotsSwitched(game: Pick<GameState, "loyalty"> | undefined, round: number): boolean {
  const flipped = (game?.loyalty ?? []).slice(0, Math.max(0, Math.min(round, 5) - 2));
  return flipped.filter(card => card === "switch").length % 2 === 1;
}
/** A player's side right now: Lancelots follow the loyalty cards, everyone else keeps their card's side. */
export function currentSide(room: Pick<Room, "game">, player: Pick<Player, "role">): "good" | "evil" {
  if (!player.role) return "good";
  const side = ROLES[player.role].side;
  if (!LANCELOTS.includes(player.role) || !room.game || !lancelotsSwitched(room.game, room.game.quest)) return side;
  return side === "good" ? "evil" : "good";
}

function allowedQuestCards(room: Room, me: Player, quest: number): QuestCard[] {
  // Official Lancelot rule: on Good's side he must succeed, on Evil's side he must fail.
  if (me.role && LANCELOTS.includes(me.role)) return currentSide(room, me) === "good" ? ["success"] : ["fail"];
  if (!me.role || ROLES[me.role].side === "good") return ["success"];
  if (me.role === "lunatic") return ["fail"];
  if (me.role === "brute" && quest > 3) return ["success"];
  return ["success", "fail"];
}
export const TEAM_SIZES: Record<number, readonly number[]> = {
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
    allowedQuestCards: allowedQuestCards(room, me, game.quest),
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
      myChecks: game.lake.checks.filter(check => check.viewerSeat === me.seat)
        .map(({ quest, targetSeat, side }) => ({ quest, targetSeat, side })),
    } : null,
    publicReveals: (game.publicReveals ?? []).map(({ seat, role }) => ({ seat, role })),
    loyalty: game.loyalty ? [...game.loyalty] : null,
    lancelotsSwitched: lancelotsSwitched(game, game.quest),
    revealedRoles: room.phase === "finished"
      ? room.players.filter((player): player is Player & { role: Role } => !!player.role)
        .map(({ seat, role }) => ({ seat, role })).sort((a, b) => a.seat - b.seat)
      : null,
    // Receipts and results are appended together when a quest resolves, so
    // they line up one to one.
    questCards: room.phase === "finished"
      ? game.quests.map((quest, index) => ({
        quest: quest.quest,
        cards: (game.questReceipts[index]?.votes ?? []).map(({ seat, card }) => ({ seat, card })).sort((a, b) => a.seat - b.seat),
      }))
      : null,
  };
}

export function roomView(room: Room, key: string, version: number, invite?: string | null): RoomView {
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
    phase: room.phase,
    hostId: room.hostId,
    hostRevision: room.hostRevision ?? 0,
    resetReason: room.resetReason ?? null,
    version,
    players: room.players.map(({ id, name, seat, ready, confirmed }) => ({
      id, name: namesHidden ? "" : name, seat, ready, confirmed,
    })).sort((a, b) => a.seat - b.seat),
    meId: me?.id ?? null,
    identity: me ? identityFor(room, me) : null,
    expiresAt: room.expiresAt,
    firstLeader: room.firstLeader ?? null,
    game: me ? gameView(room, me) : null,
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
    ...(room.ladyOfLake ? { lake: { holderSeat: room.firstLeader % room.capacity + 1, usedSeats: [], pending: false, checks: [] } } : {}),
    publicReveals: [],
    ...(room.players.some(player => player.role === "goodLancelot") ? { loyalty: shuffle<LoyaltyCard>(["keep", "keep", "keep", "switch", "switch"]).slice(0, 3) } : {}),
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
  else if (action === "lake-check") checkLake(room, game, me, input);
  else if (action === "assassinate") assassinate(room, game, me, input);
}

function requireRound(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new GameError("对局编号无效，请刷新后重试。", 400);
  }
  return value;
}

function requireCurrentRound(room: Room, input: Record<string, unknown>): void {
  const round = room.round ?? 1;
  // Keep clients of existing first-game rooms working, but an old request must
  // never prepare, leave, confirm an identity, or start a subsequent game.
  if (input.round === undefined && round === 1) return;
  if (input.round === undefined || requireRound(input.round) !== round) {
    throw new GameError("房间已进入新的对局，请刷新后重试。 ");
  }
}

function resetGame(room: Room, reason: "rematch" | "abort"): void {
  const round = room.round ?? 1;
  if (round === Number.MAX_SAFE_INTEGER) throw new GameError("请重新建立房间。 ");
  room.round = round + 1;
  room.phase = "lobby";
  room.resetReason = reason;
  delete room.game;
  delete room.firstLeader;
  delete room.lastHostTransfer;
  for (const player of room.players) {
    delete player.role;
    player.ready = false;
    player.confirmed = false;
  }
}

function rematch(room: Room, me: Player, input: Record<string, unknown>): void {
  if (room.hostId !== me.id) throw new GameError("只有房主可以开始下一局。", 403);
  const requestedRound = requireRound(input.round);
  const round = room.round ?? 1;
  // Concurrent or delayed retries from the immediately preceding game must
  // return the latest state without clearing the new game's progress.
  if (round > 1 && requestedRound === round - 1) return;
  if (requestedRound !== round) {
    throw new GameError("房间已进入新的对局，请刷新后重试。 ");
  }
  if (room.phase !== "finished") throw new GameError("请在本局结束后再开始下一局。 ");
  resetGame(room, "rematch");
}

function requireHostRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new GameError("房主权限版本无效，请刷新后重试。", 400);
  }
  return value;
}

function nextHostRevision(room: Room): number {
  const revision = room.hostRevision ?? 0;
  if (revision === Number.MAX_SAFE_INTEGER) throw new GameError("请重新建立房间。 ");
  return revision + 1;
}

function requireTargetPlayerId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 64) {
    throw new GameError("请选择有效的玩家。", 400);
  }
  return value;
}

function manageRoom(room: Room, me: Player, action: string, input: Record<string, unknown>): void {
  const round = room.round ?? 1;
  const hostRevision = room.hostRevision ?? 0;
  if (room.hostId !== me.id) {
    const receipt = room.lastHostTransfer;
    // The previous host has already lost authority. Only the exact most recent
    // successful transfer may be retried, without restoring any permissions.
    if (action === "transfer-host" && room.phase !== "closed" && receipt &&
        receipt.fromId === me.id && receipt.toId === room.hostId &&
        receipt.toId === input.targetPlayerId && receipt.round === round &&
        input.round === round && receipt.hostRevision === input.hostRevision &&
        hostRevision === receipt.hostRevision + 1) return;
    throw new GameError("只有当前房主可以管理房间。", 403);
  }
  const requestedRound = requireRound(input.round);
  const requestedRevision = requireHostRevision(input.hostRevision);
  if (requestedRevision !== hostRevision) {
    throw new GameError("房主权限已发生变化，请刷新后重试。 ");
  }
  // Retrying a completed abort must never erase the next game's progress.
  if (action === "abort" && round > 1 && requestedRound === round - 1) return;
  if (requestedRound !== round) {
    throw new GameError("房间已进入新的对局，请刷新后重试。 ");
  }
  if (action === "abort") {
    if (!["identity", "ready", "team", "vote", "quest", "lake", "assassination"].includes(room.phase)) {
      throw new GameError("只有进行中的对局可以作废；本局结束后请使用再来一局。 ");
    }
    resetGame(room, "abort");
    return;
  }
  if (action === "kick" && room.phase !== "lobby") {
    throw new GameError("只能在等待入座时移除玩家。 ");
  }
  if (room.phase === "closed") throw new GameError("房间已关闭。", 410);
  const targetId = requireTargetPlayerId(input.targetPlayerId);
  if (targetId === me.id) throw new GameError("请选择其他玩家。", 400);
  const target = room.players.find(player => player.id === targetId);
  if (action === "kick") {
    // IDs survive seat changes but are replaced on rejoining, so retrying a kick
    // cannot remove a new occupant who took the same seat.
    if (target) {
      room.players = room.players.filter(player => player.id !== targetId);
      // A removed stranger keeps no access: issue a fresh invite link.
      if (room.inviteToken) room.inviteToken = newInviteToken();
    }
    return;
  }
  if (!target) throw new GameError("这位玩家已离开房间，请刷新后重试。 ");
  const revision = nextHostRevision(room);
  room.lastHostTransfer = { fromId: me.id, toId: targetId, round, hostRevision };
  room.hostId = targetId;
  room.hostRevision = revision;
}

function readSeat(room: Room, value: unknown): number {
  const seat = Number(value);
  if (!Number.isInteger(seat) || seat < 1 || seat > room.capacity) throw new GameError("请选择有效的座位。", 400);
  return seat;
}

function recordRecovery(room: Room, player: Player, key: string, method: "code" | "host", requestId?: string): void {
  player.key = key;
  player.recovery = newRecoveryCode();
  room.takeovers = (room.takeovers ?? []).filter(request => request.seat !== player.seat && request.key !== key);
  room.recoveries = [...(room.recoveries ?? []), { seat: player.seat, method, at: Date.now(), ...(requestId ? { requestId } : {}) }]
    .slice(-MAX_RECOVERY_RECORDS);
}

// Moves an existing seat to a new device. Nobody else's hidden information is
// touched, and the previous device loses access immediately.
function deviceRecovery(room: Room, me: Player | undefined, key: string, action: string, input: Record<string, unknown>): void {
  if (room.phase === "closed") throw new GameError("房间已关闭。", 410);
  if (action === "takeover-cancel") {
    room.takeovers = (room.takeovers ?? []).filter(request => request.key !== key);
    return;
  }
  if (action === "takeover-reject") {
    // The seat's current device objects to a request for its own seat.
    if (!me) throw new GameError("请先加入房间。", 403);
    const requestId = requireTargetPlayerId(input.requestId);
    room.takeovers = (room.takeovers ?? []).filter(request => !(request.id === requestId && request.playerId === me.id));
    return;
  }
  if (action === "recover" || action === "takeover-request") {
    const seat = readSeat(room, input.seat);
    if (me) {
      if (me.seat === seat) return; // A retry after a successful recovery.
      throw new GameError(`这台设备已在 ${me.seat} 号座位，无需恢复。`);
    }
    const target = room.players.find(player => player.seat === seat);
    if (!target) throw new GameError("这个座位目前没有玩家，可以直接入座。 ");
    if (action === "recover") {
      const code = normalizeRecoveryCode(input.recoveryCode);
      if (!code) throw new GameError("恢复码格式不正确，应为 10 位字母和数字。", 400);
      if (!target.recovery || !sameSecret(code, target.recovery)) throw new GameError("恢复码不正确，或已经使用过。", 403);
      recordRecovery(room, target, key, "code");
      return;
    }
    if (target.id === room.hostId) throw new GameError("房主的座位只能使用恢复码恢复；也可以先由其他设备上的房主移交权限。", 403);
    const pending = activeTakeovers(room);
    const existing = pending.find(request => request.key === key);
    if (existing?.seat === seat) return;
    const others = pending.filter(request => request.key !== key);
    if (others.length >= MAX_TAKEOVERS || others.filter(request => request.seat === seat).length >= MAX_TAKEOVERS_PER_SEAT) {
      throw new GameError("待处理的换设备请求过多，请稍后再试。", 429);
    }
    const verifyCode = String(1000 + randomInt(9000));
    room.takeovers = [...others, { id: crypto.randomUUID(), seat, playerId: target.id, key, createdAt: Date.now(), verifyCode }];
    return;
  }
  // takeover-approve / takeover-deny: host only, bound to the current authority.
  if (!me || room.hostId !== me.id) throw new GameError("只有房主可以处理换设备请求。", 403);
  if (requireHostRevision(input.hostRevision) !== (room.hostRevision ?? 0)) {
    throw new GameError("房主权限已发生变化，请刷新后重试。 ");
  }
  const requestId = requireTargetPlayerId(input.requestId);
  const request = activeTakeovers(room).find(item => item.id === requestId);
  if (action === "takeover-deny") {
    room.takeovers = (room.takeovers ?? []).filter(item => item.id !== requestId);
    return;
  }
  if (!request) {
    if ((room.recoveries ?? []).some(record => record.requestId === requestId)) return;
    throw new GameError("这个请求已过期或已处理，请刷新后重试。 ");
  }
  const target = room.players.find(player => player.id === request.playerId && player.seat === request.seat);
  if (!target) throw new GameError("这个座位已经变化，请让对方重新发起请求。 ");
  if (target.id === room.hostId) throw new GameError("房主的座位只能使用恢复码恢复。", 403);
  if (room.players.some(player => player.key === request.key)) throw new GameError("这台设备已经在圆桌上。 ");
  const wait = request.createdAt + TAKEOVER_WAIT_MS - Date.now();
  if (wait > 0) throw new GameError(`为了让原设备有机会拒绝，请在 ${Math.ceil(wait / 1000)} 秒后再批准。`);
  recordRecovery(room, target, request.key, "host", request.id);
}

export function mutateRoom(room: Room, key: string, action: string, input: Record<string, unknown>): void {
  const me = room.players.find(player => player.key === key);
  if (["recover", "takeover-request", "takeover-cancel", "takeover-reject", "takeover-approve", "takeover-deny"].includes(action)) {
    deviceRecovery(room, me, key, action, input);
    return;
  }
  if (["kick", "transfer-host", "abort"].includes(action)) {
    if (!me) throw new GameError("请先加入房间。", 403);
    manageRoom(room, me, action, input);
    return;
  }
  if (action === "rematch") {
    if (!me) throw new GameError("请先加入房间。", 403);
    rematch(room, me, input);
    return;
  }
  requireCurrentRound(room, input);
  if (action === "join") {
    if (me) return;
    if (room.phase !== "lobby") throw new GameError("房间已发身份，不能中途加入。", 403);
    const name = nickname(input.name), seat = Number(input.seat);
    if (!Number.isInteger(seat) || seat < 1 || seat > room.capacity) {
      throw new GameError("请选择有效的座位。", 400);
    }
    if (room.players.some(player => player.seat === seat)) throw new GameError("这个座位刚被占用，请换一个。 ");
    if (room.players.length >= room.capacity) throw new GameError("房间已满。 ");
    room.players.push({ id: crypto.randomUUID(), key, name, seat, ready: false, confirmed: false,
      ...(room.schemaVersion ? { recovery: newRecoveryCode() } : {}) });
    room.takeovers = (room.takeovers ?? []).filter(request => request.key !== key);
    return;
  }
  if (!me) throw new GameError("请先加入房间。", 403);
  if (["begin", "propose", "vote", "quest", "lake-check", "assassinate"].includes(action)) {
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
    const remainingPlayers = room.players.filter(player => player.id !== me.id);
    if (room.hostId === me.id && remainingPlayers.length) {
      const revision = nextHostRevision(room);
      room.hostId = [...remainingPlayers].sort((a, b) => a.seat - b.seat)[0].id;
      room.hostRevision = revision;
      delete room.lastHostTransfer;
    }
    room.players = remainingPlayers;
    if (!room.players.length) {
      room.phase = "closed";
      return;
    }
    return;
  }
  if (action === "start") {
    if (room.hostId !== me.id) throw new GameError("只有房主可以发身份。", 403);
    if (room.players.length !== room.capacity || !room.players.every(player => player.ready)) {
      throw new GameError("请等待所有座位坐满，并且全员准备。 ");
    }
    const roles = shuffle(roomRoles(room));
    room.firstLeader = randomInt(room.capacity) + 1;
    room.players.forEach((player, index) => {
      player.role = roles[index];
      player.confirmed = false;
    });
    room.phase = "identity";
    return;
  }
  throw new GameError("不支持这个操作。", 400);
}
