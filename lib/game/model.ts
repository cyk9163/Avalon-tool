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
export interface GameState {
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
  // The leader's shown team before the vote (v1.6): public, editable while
  // the table talks, cleared when the vote starts or the leadership passes.
  draftTeam?: number[];
  // Speaking order for the current team turn (v1.8): public. It starts with the
  // leader and goes round the table; index === capacity means everyone spoke.
  speech?: { turnId: string; index: number; startedAt: number };
  // Soft per-speaker timer in seconds (0 = off), kept across turns.
  speechSeconds?: number;
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
  draftTeam: number[];
  // Who has the floor during team building; null outside the team phase.
  // `now` is the server clock, so every phone counts down the same timer.
  speech: { order: number[]; index: number; startedAt: number; seconds: number; now: number } | null;
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
  // When false, the table talks in person: the leader shows a team and calls the vote.
  // Omitted on rooms created before this option, which keep the speaking order.
  turnSpeech?: boolean;
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
  // Finished games in this room (v1.9), newest last, for the same-room record.
  history?: RoundRecord[];
  // Lobby-only asks to exchange seat numbers so the circle matches where people are sitting.
  seatSwaps?: { id: string; fromId: string; toId: string; toSeat: number; createdAt: number }[];
}
export interface RoundRecord {
  round: number;
  winner: "good" | "evil";
  reason: GameResult["reason"];
  // Final side: Lancelots end on whichever side the loyalty cards left them.
  players: { id: string; name: string; seat: number; role: Role; side: "good" | "evil" }[];
}
export const MAX_HISTORY = 30;
export const ROOM_SCHEMA_VERSION = 2;
export const TAKEOVER_TTL_MS = 15 * 60 * 1000;
// The seat owner's current device is warned and can object during this window;
// the host cannot approve before it ends. It prevents a host from silently
// moving another player's seat (and hidden role) to a device of their own.
export const TAKEOVER_WAIT_MS = 60 * 1000;
export const MAX_TAKEOVERS = 8;
export const MAX_TAKEOVERS_PER_SEAT = 3;
export const MAX_RECOVERY_RECORDS = 20;
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
  turnSpeech: boolean;
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
  // Earlier finished games in this room that I played in (v1.9). Roles are
  // only ever shown to people who were in that game, as at its end.
  history: RoundRecord[];
  seatSwapOut: { id: string; seat: number; name: string } | null;
  seatSwapIn: { id: string; fromSeat: number; name: string; seat: number }[];
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
export function activeTakeovers(room: Room, now = Date.now()): TakeoverRequest[] {
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

export const LANCELOTS: readonly Role[] = ["goodLancelot", "evilLancelot"];
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

export function allowedQuestCards(room: Room, me: Player, quest: number): QuestCard[] {
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

export function teamSize(room: Room, quest: number): number {
  const size = TEAM_SIZES[room.capacity]?.[quest - 1];
  if (!size) throw new GameError("任务配置无效，请重新建立房间。", 400);
  return size;
}

export function failsRequired(room: Room, quest: number): number {
  return room.capacity >= 7 && quest === 4 ? 2 : 1;
}

export const SPEECH_SECONDS = [0, 60, 90, 120, 180] as const;
export const DEFAULT_SPEECH_SECONDS = 90;

/** Leader first, then round the table by seat number. */
export function speakingOrder(room: Pick<Room, "capacity">, leaderSeat: number): number[] {
  return Array.from({ length: room.capacity }, (_, index) => (leaderSeat - 1 + index) % room.capacity + 1);
}
