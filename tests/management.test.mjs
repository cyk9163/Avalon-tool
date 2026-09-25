import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool} from "../lib/game.ts";

function lobby() {
  return {
    code: "456789", capacity: 5, preset: "classic", phase: "lobby", hostId: "p1",
    players: Array.from({length: 5}, (_, index) => ({
      id: `p${index + 1}`, key: `private-device-${index + 1}`, name: `玩家${index + 1}`,
      seat: index + 1, ready: false, confirmed: false,
    })),
    createdAt: 10, expiresAt: 86400010, requestId: "management-tests",
  };
}
function member(room, seat = 1) { return room.players.find(player => player.seat === seat); }
function view(room, seat = 1) { return roomView(room, member(room, seat).key, 1); }
function version(room) { return {round: view(room).round, hostRevision: view(room).hostRevision}; }
function act(room, seat, action, input = {}) {
  mutateRoom(room, member(room, seat).key, action, {...version(room), ...input});
}
function hostSeat(room) { return room.players.find(player => player.id === room.hostId).seat; }
function invalid(room, action, status) {
  const before = JSON.stringify(room);
  assert.throws(action, error => status === undefined || error.status === status);
  assert.equal(JSON.stringify(room), before, "invalid management requests must not partially mutate state");
}
function deal(room) {
  for (const player of room.players) act(room, player.seat, "ready", {ready: true});
  act(room, hostSeat(room), "start");
}
function begin(room) {
  for (const player of room.players) act(room, player.seat, "confirm");
  act(room, hostSeat(room), "begin");
}
function propose(room) {
  const {turnId, leaderSeat, teamSize} = view(room).game;
  const team = room.players.slice(0, teamSize).map(player => player.seat);
  act(room, leaderSeat, "propose", {turnId, team});
  return {turnId, team};
}
function approve(room) {
  const {turnId} = view(room).game;
  for (const player of room.players) act(room, player.seat, "vote", {turnId, approve: true});
}
function mission(room) {
  const {turnId, team} = propose(room);
  approve(room);
  for (const seat of team) act(room, seat, "quest", {turnId, card: "success"});
  return turnId;
}
function atPhase(phase) {
  const room = lobby();
  if (phase === "lobby") return room;
  if (phase === "closed") { room.phase = "closed"; return room; }
  deal(room);
  if (phase === "identity") return room;
  for (const player of room.players) act(room, player.seat, "confirm");
  if (phase === "ready") return room;
  act(room, 1, "begin");
  if (phase === "team") return room;
  if (phase === "vote" || phase === "quest") {
    propose(room);
    if (phase === "quest") approve(room);
    return room;
  }
  for (let count = 0; count < 3; count++) mission(room);
  if (phase === "assassination") return room;
  const assassin = room.players.find(player => player.role === "assassin");
  const merlin = room.players.find(player => player.role === "merlin");
  act(room, assassin.seat, "assassinate", {turnId: view(room).game.turnId, targetSeat: merlin.seat});
  return room;
}

test("Legacy host revision projects as zero, while every new management operation requires explicit valid authority and round", () => {
  const room = lobby(), before = JSON.stringify(room);
  assert.equal(view(room).hostRevision, 0);
  assert.equal(view(room).resetReason, null);
  assert.equal(JSON.stringify(room), before);
  for (const action of ["kick", "transfer-host", "abort"]) {
    for (const hostRevision of [undefined, null, "0", -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      invalid(room, () => act(room, 1, action, {targetPlayerId: "p5", hostRevision}), 400);
    }
    for (const round of [undefined, null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      invalid(room, () => act(room, 1, action, {targetPlayerId: "p5", round}), 400);
    }
    invalid(room, () => act(room, 1, action, {targetPlayerId: "p5", hostRevision: 1}), 409);
    invalid(room, () => act(room, 1, action, {targetPlayerId: "p5", round: 2}), 409);
  }
});

test("Management never accepts a non-host or outsider pretending to be the host", () => {
  for (const action of ["kick", "transfer-host", "abort"]) {
    const room = action === "abort" ? atPhase("quest") : lobby();
    invalid(room, () => act(room, 2, action, {targetPlayerId: "p5", playerId: "p1"}), 403);
    invalid(room, () => mutateRoom(room, "outsider", action, {
      ...version(room), targetPlayerId: "p5", playerId: "p1",
    }), 403);
  }
});

test("Kick is lobby-only, targets a stable other-player ID and cannot remove a replacement in the same seat", () => {
  const room = lobby();
  invalid(room, () => act(room, 1, "kick", {targetPlayerId: "p1"}), 400);
  for (const targetPlayerId of [undefined, null, "", 5]) {
    invalid(room, () => act(room, 1, "kick", {targetPlayerId}), 400);
  }
  act(room, 1, "kick", {targetPlayerId: "p5"});
  assert.equal(room.players.length, 4);
  assert.equal(view(room).hostRevision, 0);
  assert.equal(room.hostId, "p1");
  const removed = JSON.stringify(room);
  act(room, 1, "kick", {targetPlayerId: "p5"});
  assert.equal(JSON.stringify(room), removed);
  mutateRoom(room, "replacement-device", "join", {round: 1, name: "新朋友", seat: 5});
  const replacement = member(room, 5);
  assert.notEqual(replacement.id, "p5");
  const restored = JSON.stringify(room);
  act(room, 1, "kick", {targetPlayerId: "p5"});
  assert.equal(JSON.stringify(room), restored);
  assert.equal(member(room, 5).id, replacement.id);
  for (const phase of ["identity", "ready", "team", "vote", "quest", "assassination", "finished", "closed"]) {
    const active = atPhase(phase);
    invalid(active, () => act(active, 1, "kick", {targetPlayerId: "p5"}), 409);
  }
});

test("Host transfer works throughout a nonclosed game without revealing or changing identities, ballots or turn state", () => {
  for (const phase of ["lobby", "identity", "ready", "team", "vote", "quest", "assassination", "finished"]) {
    const room = atPhase(phase), before = structuredClone(room);
    act(room, 1, "transfer-host", {targetPlayerId: "p2"});
    assert.equal(room.hostId, "p2");
    assert.equal(view(room).hostRevision, 1);
    assert.equal(room.phase, phase);
    assert.equal(view(room).round, 1);
    assert.equal(room.expiresAt, before.expiresAt);
    assert.deepEqual(room.players, before.players);
    assert.deepEqual(room.game, before.game);
    for (const player of room.players) {
      const projected = view(room, player.seat);
      assert.equal(projected.hostRevision, 1);
      assert.ok(!JSON.stringify(projected).includes("private-device-"));
      assert.ok(!Object.hasOwn(projected, "hostTransferReceipt"));
      assert.ok(!Object.hasOwn(projected, "lastHostTransfer"));
      assert.ok(projected.players.every(person => !Object.hasOwn(person, "role")));
    }
  }
  const closed = atPhase("closed");
  invalid(closed, () => act(closed, 1, "transfer-host", {targetPlayerId: "p2"}), 410);
  const room = lobby();
  for (const targetPlayerId of [undefined, null, "", 5, "p1", "not-a-member"]) {
    invalid(room, () => act(room, 1, "transfer-host", {targetPlayerId}));
  }
});

test("A former host can retry only its identical latest transfer, and an A-to-B-to-A cycle rejects A's old authority", () => {
  const room = lobby();
  const original = {round: 1, hostRevision: 0, targetPlayerId: "p2"};
  act(room, 1, "transfer-host", original);
  const transferred = JSON.stringify(room);
  act(room, 1, "transfer-host", original);
  assert.equal(JSON.stringify(room), transferred);
  invalid(room, () => act(room, 1, "transfer-host", {...original, targetPlayerId: "p3"}), 403);
  invalid(room, () => act(room, 1, "kick", {targetPlayerId: "p5", hostRevision: 0}), 403);
  act(room, 2, "transfer-host", {targetPlayerId: "p1"});
  assert.equal(view(room).hostRevision, 2);
  assert.equal(room.hostId, "p1");
  invalid(room, () => act(room, 1, "transfer-host", original), 409);
  invalid(room, () => act(room, 1, "kick", {targetPlayerId: "p5", hostRevision: 0}), 409);
  act(room, 1, "transfer-host", {targetPlayerId: "p3"});
  assert.equal(room.hostId, "p3");
  assert.equal(view(room).hostRevision, 3);
});

test("Automatic host succession advances authority and invalidates a transfer receipt from the former host", () => {
  const room = lobby();
  act(room, 1, "leave");
  assert.equal(room.hostId, "p2");
  assert.equal(view(room, 2).hostRevision, 1);
  const request = {round: 1, hostRevision: 1, targetPlayerId: "p3"};
  mutateRoom(room, member(room, 2).key, "transfer-host", request);
  assert.equal(room.hostId, "p3");
  assert.equal(view(room, 2).hostRevision, 2);
  mutateRoom(room, member(room, 3).key, "leave", {round: 1});
  assert.equal(room.hostId, "p2");
  assert.equal(view(room, 2).hostRevision, 3);
  invalid(room, () => mutateRoom(room, member(room, 2).key, "transfer-host", request), 409);
});

test("Abort is permitted only during an active game and increments the round without keeping private state", () => {
  for (const phase of ["identity", "ready", "team", "vote", "quest", "assassination"]) {
    const room = atPhase(phase), before = structuredClone(room);
    act(room, 1, "abort");
    assert.equal(room.phase, "lobby");
    assert.equal(view(room).round, 2);
    assert.equal(view(room).resetReason, "abort");
    assert.equal(view(room).hostRevision, 0);
    for (const field of ["code", "capacity", "preset", "hostId", "createdAt", "expiresAt", "requestId"]) {
      assert.equal(room[field], before[field]);
    }
    assert.deepEqual(room.players, before.players.map(player => {
    const withoutRole = {...player};
    delete withoutRole.role;
    return {...withoutRole, ready: false, confirmed: false};
  }));
    assert.equal(room.game, undefined);
    assert.equal(room.firstLeader, undefined);
    for (const player of room.players) {
      assert.equal(view(room, player.seat).identity, null);
      assert.equal(view(room, player.seat).game, null);
      assert.equal(view(room, player.seat).firstLeader, null);
    }
  }
  for (const phase of ["lobby", "finished", "closed"]) {
    const room = atPhase(phase);
    invalid(room, () => act(room, 1, "abort"), 409);
  }
});

test("Abort retries cannot erase a new game's votes or replay private cards from the abandoned game", () => {
  const room = atPhase("team");
  const oldTurn = mission(room);
  propose(room);
  act(room, 1, "vote", {turnId: view(room).game.turnId, approve: true});
  assert.equal(room.game.questReceipts.length, 1);
  const abortRequest = {round: 1, hostRevision: 0};
  act(room, 1, "abort", abortRequest);
  const reset = JSON.stringify(room);
  act(room, 1, "abort", abortRequest);
  assert.equal(JSON.stringify(room), reset);
  deal(room);
  begin(room);
  const {turnId} = propose(room);
  act(room, 2, "vote", {turnId, approve: true});
  const newVote = JSON.stringify(room);
  act(room, 1, "abort", abortRequest);
  assert.equal(JSON.stringify(room), newVote);
  assert.deepEqual(view(room).game.votedSeats, [2]);
  invalid(room, () => act(room, 1, "vote", {round: 1, turnId: oldTurn, approve: true}), 409);
  invalid(room, () => act(room, 1, "quest", {round: 2, turnId: oldTurn, card: "success"}), 409);
  invalid(room, () => act(room, 2, "abort", abortRequest), 403);
  act(room, 1, "abort");
  assert.equal(view(room).round, 3);
  invalid(room, () => act(room, 1, "abort", abortRequest), 409);
});

test("Transfer, abort, removal and replacement lead to a complete fresh game with the new host", () => {
  const room = atPhase("quest");
  const transfer = {round: 1, hostRevision: 0, targetPlayerId: "p2"};
  act(room, 1, "transfer-host", transfer);
  act(room, 2, "abort");
  invalid(room, () => act(room, 1, "transfer-host", transfer), 403);
  assert.equal(room.hostId, "p2");
  act(room, 2, "kick", {targetPlayerId: "p5"});
  mutateRoom(room, "replacement-key", "join", {round: 2, name: "补位朋友", seat: 5});
  deal(room);
  assert.deepEqual(room.players.map(player => player.role).sort(), rolePool(5, "classic").sort());
  begin(room);
  for (let count = 0; count < 3; count++) mission(room);
  const assassin = room.players.find(player => player.role === "assassin");
  const loyal = room.players.find(player => player.role === "loyal");
  act(room, assassin.seat, "assassinate", {turnId: view(room).game.turnId, targetSeat: loyal.seat});
  assert.equal(view(room).game.result.winner, "good");
  assert.equal(view(room).round, 2);
  assert.equal(view(room).hostRevision, 1);
  assert.equal(room.hostId, "p2");
  assert.equal(roomView(room, "private-device-5", 1).game, null);
  act(room, 2, "rematch");
  assert.equal(view(room).resetReason, "rematch");
  assert.equal(view(room).round, 3);
});

test("players swap seat numbers only when the person sitting there agrees", () => {
  const room = lobby();
  for (const player of room.players) player.ready = true;
  act(room, 2, "swap-request", {seat: 4});
  const offer = view(room, 2).seatSwapOut;
  assert.equal(offer.seat, 4);
  assert.equal(offer.name, "玩家4");
  assert.equal(view(room, 1).seatSwapIn.length, 0, "other players do not see the request");
  assert.equal(view(room, 4).seatSwapIn[0].fromSeat, 2);
  act(room, 2, "swap-request", {seat: 4});
  assert.equal(room.seatSwaps.length, 1, "asking again for the same number does not duplicate");
  invalid(room, () => act(room, 1, "swap-accept", {requestId: offer.id}), 403);
  act(room, 4, "swap-accept", {requestId: offer.id});
  assert.equal(member(room, 4).id, "p2");
  assert.equal(member(room, 2).id, "p4");
  assert.equal(member(room, 4).ready, false);
  assert.equal(member(room, 2).ready, false);
  assert.equal(room.seatSwaps, undefined);
  act(room, 4, "swap-request", {seat: 2});
  act(room, 2, "swap-reject", {requestId: view(room, 2).seatSwapIn[0].id});
  assert.equal(member(room, 4).id, "p2");
  act(room, 4, "swap-request", {seat: 3});
  act(room, 4, "swap-cancel");
  assert.equal(view(room, 4).seatSwapOut, null);
  act(room, 4, "swap-request", {seat: 3});
  invalid(room, () => act(room, 4, "swap-request", {seat: 9}), 400);
  deal(room);
  invalid(room, () => act(room, 4, "swap-accept", {requestId: "gone"}), undefined);
  assert.equal(room.phase === "lobby", false);
});
