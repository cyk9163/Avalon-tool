import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, newRecoveryCode, normalizeRecoveryCode, newInviteToken, sameSecret, TAKEOVER_TTL_MS, TAKEOVER_WAIT_MS, ROOM_SCHEMA_VERSION} from "../lib/game.ts";

// A v2 (v0.8) room: invite token plus a recovery code per seat.
function lobby() {
  return {
    code: "345678", capacity: 5, preset: "classic", phase: "lobby", hostId: "p1", hostRevision: 0, round: 1,
    players: Array.from({length: 5}, (_, index) => ({
      id: `p${index + 1}`, key: `device-${index + 1}`, name: `玩家${index + 1}`,
      seat: index + 1, ready: false, confirmed: false, recovery: newRecoveryCode(),
    })),
    createdAt: 10, expiresAt: Date.now() + 86400000, requestId: "recovery-tests",
    schemaVersion: ROOM_SCHEMA_VERSION, inviteToken: newInviteToken(), takeovers: [], recoveries: [],
  };
}
const member = (room, seat) => room.players.find(player => player.seat === seat);
const act = (room, key, action, input = {}) => mutateRoom(room, key, action, {round: room.round, hostRevision: room.hostRevision ?? 0, ...input});
function dealt(room) {
  for (const player of room.players) act(room, player.key, "ready", {ready: true});
  act(room, "device-1", "start");
  return room;
}
function unchanged(room, run, status) {
  const before = JSON.stringify(room);
  assert.throws(run, error => status === undefined || error.status === status);
  assert.equal(JSON.stringify(room), before, "rejected recovery requests must not mutate state");
}

test("recovery codes and invite tokens are well-formed, random and compared safely", () => {
  const codes = new Set(Array.from({length: 200}, newRecoveryCode));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  assert.equal(normalizeRecoveryCode(" abcde fghjk "), "ABCDE-FGHJK");
  for (const bad of [undefined, 42, "", "ABCDE-FGHJ", "ABCDE-FGHI1", "O".repeat(10), "A".repeat(40)]) assert.equal(normalizeRecoveryCode(bad), null);
  const token = newInviteToken();
  assert.match(token, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(sameSecret(token, token));
  assert.ok(!sameSecret(token, token.slice(0, -1)));
  assert.ok(!sameSecret(token, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`));
});

test("outsiders need the invite link to see nicknames; members see their own recovery code only", () => {
  const room = lobby();
  const blind = roomView(room, "stranger", 1);
  assert.equal(blind.namesHidden, true);
  assert.ok(blind.players.every(player => player.name === ""));
  assert.equal(blind.inviteToken, null);
  assert.equal(blind.recoveryCode, null);
  assert.ok(!JSON.stringify(blind).includes(member(room, 2).recovery));
  const invited = roomView(room, "stranger", 1, room.inviteToken);
  assert.equal(invited.namesHidden, false);
  assert.equal(invited.players[1].name, "玩家2");
  assert.equal(roomView(room, "stranger", 1, "wrong-token-value-xyz").namesHidden, true);
  const mine = roomView(room, "device-2", 1);
  assert.equal(mine.namesHidden, false);
  assert.equal(mine.inviteToken, room.inviteToken);
  assert.equal(mine.recoveryCode, member(room, 2).recovery);
  const serialized = JSON.stringify(mine);
  for (const other of room.players.filter(player => player.seat !== 2)) assert.ok(!serialized.includes(other.recovery));
  // Legacy (pre-v0.8) rooms have no token and keep the old behaviour.
  const legacy = lobby(); delete legacy.inviteToken;
  assert.equal(roomView(legacy, "stranger", 1).namesHidden, false);
});

test("a correct recovery code moves the seat and identity to the new device and rotates the code", () => {
  const room = dealt(lobby()), target = member(room, 3), oldCode = target.recovery, identity = roomView(room, "device-3", 1).identity;
  unchanged(room, () => act(room, "new-phone", "recover", {seat: 3, recoveryCode: "22222-22222"}), 403);
  unchanged(room, () => act(room, "new-phone", "recover", {seat: 3, recoveryCode: "nope"}), 400);
  unchanged(room, () => act(room, "new-phone", "recover", {seat: 9, recoveryCode: oldCode}), 400);
  act(room, "new-phone", "recover", {seat: 3, recoveryCode: oldCode.toLowerCase().replace("-", " ")});
  assert.equal(target.key, "new-phone");
  assert.notEqual(target.recovery, oldCode);
  assert.deepEqual(roomView(room, "new-phone", 1).identity, identity);
  assert.equal(roomView(room, "device-3", 1).meId, null, "the previous device loses access immediately");
  assert.equal(roomView(room, "device-3", 1).identity, null);
  assert.deepEqual(roomView(room, "device-1", 1).recoveries.map(({seat, method}) => ({seat, method})), [{seat: 3, method: "code"}]);
  // Retrying on the new device is harmless; the used code cannot be replayed elsewhere.
  act(room, "new-phone", "recover", {seat: 3, recoveryCode: oldCode});
  unchanged(room, () => act(room, "thief", "recover", {seat: 3, recoveryCode: oldCode}), 403);
  unchanged(room, () => act(room, "device-4", "recover", {seat: 3, recoveryCode: target.recovery}));
});

test("the host approves a takeover request; the host seat itself requires a recovery code", () => {
  const room = dealt(lobby());
  unchanged(room, () => act(room, "new-phone", "takeover-request", {seat: 1}), 403);
  unchanged(room, () => act(room, "new-phone", "takeover-request", {seat: 7}), 400);
  act(room, "new-phone", "takeover-request", {seat: 4});
  act(room, "new-phone", "takeover-request", {seat: 4});
  assert.equal(room.takeovers.length, 1, "a repeated request is idempotent");
  const pending = roomView(room, "new-phone", 1);
  assert.equal(pending.meId, null);
  assert.equal(pending.myTakeover.seat, 4);
  assert.equal(roomView(room, "device-2", 1).takeoverRequests.length, 0, "only the host sees requests");
  const hostView = roomView(room, "device-1", 1);
  assert.deepEqual(hostView.takeoverRequests.map(({seat, name}) => ({seat, name})), [{seat: 4, name: "玩家4"}]);
  assert.match(pending.myTakeover.verifyCode, /^\d{4}$/);
  assert.equal(hostView.takeoverRequests[0].verifyCode, pending.myTakeover.verifyCode, "host and requester see the same pairing code");
  const owner = roomView(room, "device-4", 1);
  assert.deepEqual(owner.takeoversOfMySeat.map(({verifyCode}) => verifyCode), [pending.myTakeover.verifyCode], "the seat owner is warned");
  assert.equal(roomView(room, "device-5", 1).takeoversOfMySeat.length, 0);
  assert.ok(!JSON.stringify(hostView).includes("new-phone"), "requesting device credentials never reach clients");
  const requestId = hostView.takeoverRequests[0].id;
  unchanged(room, () => act(room, "device-2", "takeover-approve", {requestId}), 403);
  unchanged(room, () => act(room, "device-1", "takeover-approve", {requestId, hostRevision: 5}));
  unchanged(room, () => act(room, "device-1", "takeover-approve", {requestId}), 409);
  room.takeovers[0].createdAt -= TAKEOVER_WAIT_MS; // the objection window has passed
  const identity = roomView(room, "device-4", 1).identity;
  act(room, "device-1", "takeover-approve", {requestId});
  assert.equal(member(room, 4).key, "new-phone");
  assert.deepEqual(roomView(room, "new-phone", 1).identity, identity);
  assert.equal(roomView(room, "device-4", 1).meId, null);
  assert.equal(room.takeovers.length, 0);
  act(room, "device-1", "takeover-approve", {requestId}); // retry after success
  assert.equal(member(room, 4).key, "new-phone");
  assert.equal(room.recoveries.at(-1).method, "host");
});

test("the seat owner can reject a takeover, so a host cannot silently move another player's role", () => {
  const room = dealt(lobby());
  act(room, "host-second-phone", "takeover-request", {seat: 2});
  const requestId = room.takeovers[0].id;
  act(room, "device-3", "takeover-reject", {requestId});
  assert.equal(room.takeovers.length, 1, "only the seat's own device can reject");
  act(room, "device-2", "takeover-reject", {requestId});
  assert.equal(room.takeovers.length, 0);
  unchanged(room, () => act(room, "device-1", "takeover-approve", {requestId}));
  assert.equal(member(room, 2).key, "device-2");
  // At most three pending requests per seat; kicking a player issues a fresh invite link.
  for (const phone of ["a", "b", "c"]) act(room, `phone-${phone}`, "takeover-request", {seat: 5});
  unchanged(room, () => act(room, "phone-d", "takeover-request", {seat: 5}), 429);
  const lobbyRoom = lobby(), before = lobbyRoom.inviteToken;
  act(lobbyRoom, "device-1", "kick", {targetPlayerId: "p5"});
  assert.notEqual(lobbyRoom.inviteToken, before);
  assert.match(lobbyRoom.inviteToken, /^[A-Za-z0-9_-]{22}$/);
});

test("takeover requests can be denied or cancelled, lapse, and never target a changed seat", () => {
  const room = lobby();
  act(room, "phone-a", "takeover-request", {seat: 2});
  act(room, "phone-b", "takeover-request", {seat: 3});
  act(room, "phone-a", "takeover-cancel");
  assert.deepEqual(room.takeovers.map(request => request.seat), [3]);
  act(room, "device-1", "takeover-deny", {requestId: room.takeovers[0].id});
  assert.equal(room.takeovers.length, 0);
  act(room, "phone-c", "takeover-request", {seat: 5});
  const requestId = room.takeovers[0].id;
  act(room, "device-5", "seat", {seat: 5}); // no-op seat change keeps it valid
  act(room, "device-1", "kick", {targetPlayerId: "p5"});
  assert.equal(roomView(room, "device-1", 1).takeoverRequests.length, 0, "a request for a vacated seat lapses");
  unchanged(room, () => act(room, "device-1", "takeover-approve", {requestId}));
  act(room, "phone-d", "takeover-request", {seat: 2});
  room.takeovers[0].createdAt -= TAKEOVER_TTL_MS + 1;
  assert.equal(roomView(room, "device-1", 1).takeoverRequests.length, 0, "requests expire");
  assert.equal(roomView(room, "phone-d", 1).myTakeover, null);
  // A device already seated cannot request or recover another seat.
  unchanged(room, () => act(room, "device-2", "takeover-request", {seat: 3}));
});

test("joining a v2 room issues a recovery code and clears the device's pending request", () => {
  const room = lobby();
  room.players = room.players.filter(player => player.seat !== 5);
  act(room, "newcomer", "takeover-request", {seat: 2});
  act(room, "newcomer", "join", {seat: 5, name: "新朋友"});
  const joined = room.players.find(player => player.key === "newcomer");
  assert.match(joined.recovery, /^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  assert.equal(room.takeovers.length, 0);
  // Pre-v0.8 rooms keep their stored shape.
  const legacy = lobby(); delete legacy.schemaVersion; legacy.players = legacy.players.slice(0, 4);
  act(legacy, "newcomer", "join", {seat: 5, name: "新朋友"});
  assert.equal(legacy.players.find(player => player.key === "newcomer").recovery, undefined);
});
