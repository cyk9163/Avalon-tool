import { gameAction } from "./play.ts";
import {
  GameError, MAX_RECOVERY_RECORDS, MAX_TAKEOVERS, MAX_TAKEOVERS_PER_SEAT, TAKEOVER_WAIT_MS,
  activeTakeovers, newInviteToken, newRecoveryCode, nickname, normalizeRecoveryCode, randomInt, roomRoles, sameSecret, shuffle,
} from "./model.ts";
import type { Player, Room } from "./model.ts";

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
  if (reason === "rematch" && room.firstLeader) room.nextFirstLeader = room.firstLeader % room.capacity + 1;
  else delete room.nextFirstLeader;
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
      forgetSeatSwaps(room, targetId);
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

function forgetSeatSwaps(room: Room, playerId: string): void {
  room.seatSwaps = (room.seatSwaps ?? []).filter(request => request.fromId !== playerId && request.toId !== playerId);
  if (!room.seatSwaps.length) delete room.seatSwaps;
}

function seatSwap(room: Room, me: Player, action: string, input: Record<string, unknown>): void {
  const swaps = room.seatSwaps ?? [];
  if (action === "swap-cancel") {
    const kept = swaps.filter(request => request.fromId !== me.id);
    if (kept.length) room.seatSwaps = kept;
    else delete room.seatSwaps;
    return;
  }
  if (action === "swap-reject" || action === "swap-accept") {
    const id = requireTargetPlayerId(input.requestId);
    const request = swaps.find(item => item.id === id);
    if (!request) return;
    if (request.toId !== me.id) throw new GameError("只有这个号码上的玩家可以处理换号申请。", 403);
    if (action === "swap-reject") {
      const kept = swaps.filter(item => item.id !== id);
      if (kept.length) room.seatSwaps = kept;
      else delete room.seatSwaps;
      return;
    }
    const from = room.players.find(player => player.id === request.fromId);
    const to = room.players.find(player => player.id === request.toId);
    if (!from || !to || to.seat !== request.toSeat || from.seat === to.seat) {
      const kept = swaps.filter(item => item.id !== id);
      if (kept.length) room.seatSwaps = kept;
      else delete room.seatSwaps;
      throw new GameError("座位已经变化，请让对方重新申请。");
    }
    const fromSeat = from.seat;
    from.seat = to.seat;
    to.seat = fromSeat;
    from.ready = false;
    to.ready = false;
    const involved = new Set([from.id, to.id]);
    const kept = swaps.filter(item => !involved.has(item.fromId) && !involved.has(item.toId));
    if (kept.length) room.seatSwaps = kept;
    else delete room.seatSwaps;
    return;
  }
  const seat = readSeat(room, input.seat);
  if (seat === me.seat) return;
  const target = room.players.find(player => player.seat === seat);
  if (!target) throw new GameError("这个号码现在是空的，可以直接入座。", 400);
  const mine = swaps.find(item => item.fromId === me.id);
  if (mine?.toId === target.id && mine.toSeat === seat) return;
  const next = swaps.filter(item => item.fromId !== me.id);
  if (next.length >= 20) throw new GameError("换号申请太多，请稍后再试。", 429);
  room.seatSwaps = [...next, { id: crypto.randomUUID(), fromId: me.id, toId: target.id, toSeat: seat, createdAt: Date.now() }];
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
  if (["begin", "propose", "draft", "speech", "vote", "quest", "lake-check", "assassinate"].includes(action)) {
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
    const kept = (room.seatSwaps ?? []).filter(request => request.fromId !== me.id);
    if (kept.length) room.seatSwaps = kept;
    else delete room.seatSwaps;
    return;
  }
  if (action === "swap-request" || action === "swap-cancel" || action === "swap-accept" || action === "swap-reject") {
    seatSwap(room, me, action, input);
    return;
  }
  if (action === "leave") {
    const remainingPlayers = room.players.filter(player => player.id !== me.id);
    forgetSeatSwaps(room, me.id);
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
    delete room.seatSwaps;
    const roles = shuffle(roomRoles(room));
    const carried = room.resetReason === "rematch" ? room.nextFirstLeader : undefined;
    room.firstLeader = carried && carried >= 1 && carried <= room.capacity ? carried : randomInt(room.capacity) + 1;
    delete room.nextFirstLeader;
    room.players.forEach((player, index) => {
      player.role = roles[index];
      player.confirmed = false;
    });
    room.phase = "identity";
    return;
  }
  throw new GameError("不支持这个操作。", 400);
}

