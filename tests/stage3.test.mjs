import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool} from "../lib/game.ts";

function sample() {
  return {
    code: "654321", capacity: 5, preset: "classic", phase: "ready", hostId: "p1",
    players: rolePool(5, "classic").map((role, index) => ({
      id: `p${index + 1}`, key: `private-key-${index + 1}`, name: `玩家${index + 1}`,
      seat: index + 1, ready: true, confirmed: true, role,
    })),
    createdAt: 100, expiresAt: 86400100, requestId: "original-create-request", firstLeader: 3,
  };
}
function player(room, seat = 1) { return room.players.find(person => person.seat === seat); }
function view(room, seat = 1) { return roomView(room, player(room, seat).key, 1); }
function act(room, seat, action, input = {}) {
  mutateRoom(room, player(room, seat).key, action, {round: view(room).round, ...input});
}
function invalid(room, callback, status) {
  const before = JSON.stringify(room);
  assert.throws(callback, error => status === undefined || error.status === status);
  assert.equal(JSON.stringify(room), before, "a rejected request must not partially mutate room state");
}
function mission(room) {
  const {turnId, leaderSeat, teamSize} = view(room).game;
  const team = room.players.slice(0, teamSize).map(person => person.seat);
  act(room, leaderSeat, "propose", {turnId, team});
  for (const person of room.players) act(room, person.seat, "vote", {turnId, approve: true});
  for (const seat of team) act(room, seat, "quest", {turnId, card: "success"});
  return turnId;
}
function finish(room, hit = true) {
  for (let count = 0; count < 3; count++) mission(room);
  assert.equal(room.phase, "assassination");
  const assassin = room.players.find(person => person.role === "assassin");
  const target = room.players.find(person => hit ? person.role === "merlin" : person.role === "loyal");
  act(room, assassin.seat, "assassinate", {turnId: view(room).game.turnId, targetSeat: target.seat});
  assert.equal(room.phase, "finished");
}
function finished() {
  const room = sample();
  act(room, 1, "begin");
  finish(room);
  return room;
}
function dealAgain(room) {
  for (const person of room.players) act(room, person.seat, "ready", {ready: true});
  act(room, 1, "start");
  for (const person of room.players) act(room, person.seat, "confirm");
  act(room, 1, "begin");
}

test("Legacy rooms expose round one without changing stored state and still accept old first-game clients", () => {
  const room = sample();
  const before = JSON.stringify(room);
  assert.equal(view(room).round, 1);
  assert.equal(roomView(room, "outsider", 1).round, 1);
  assert.equal(JSON.stringify(room), before);
  mutateRoom(room, player(room).key, "begin", {});
  assert.equal(room.phase, "team");
  const started = JSON.stringify(room);
  mutateRoom(room, player(room).key, "begin", {round: 1});
  assert.equal(JSON.stringify(room), started);
  for (const round of [0, -1, 2, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null, true]) {
    invalid(room, () => mutateRoom(room, player(room).key, "begin", {round}));
  }
});

test("Only the current host can rematch, and an explicit valid round and completed game are required", () => {
  const room = finished();
  for (const round of [undefined, null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    invalid(room, () => mutateRoom(room, player(room).key, "rematch", {round}), 400);
  }
  invalid(room, () => act(room, 2, "rematch"), 403);
  invalid(room, () => mutateRoom(room, "outsider", "rematch", {round: 1, playerId: room.hostId}), 403);
  invalid(room, () => act(room, 1, "rematch", {round: 2}), 409);
  for (const phase of ["lobby", "identity", "ready", "team", "vote", "quest", "assassination", "closed"]) {
    const unfinished = structuredClone(room);
    unfinished.phase = phase;
    invalid(unfinished, () => act(unfinished, 1, "rematch"), 409);
  }
});

test("A rematch preserves the room and roster but removes every old identity, ballot, card receipt and leader", () => {
  const room = finished();
  assert.equal(room.game.questReceipts.length, 3, "fixture includes actual private task-card receipts");
  const expected = {
    code: room.code, capacity: room.capacity, preset: room.preset, hostId: room.hostId,
    createdAt: room.createdAt, expiresAt: room.expiresAt, requestId: room.requestId,
    players: room.players.map(({id, key, name, seat}) => ({id, key, name, seat, ready: false, confirmed: false})),
    phase: "lobby", round: 2, resetReason: "rematch",
    // v1.9: the finished game's public end record stays for the same-room record.
    history: structuredClone(room.history),
  };
  assert.equal(room.history.length, 1);
  assert.ok(!/private-key-|questReceipts|"card"/.test(JSON.stringify(room.history)), "the record holds no keys or card receipts");
  act(room, 1, "rematch");
  assert.deepEqual(room, expected);
  for (const person of room.players) {
    const projected = view(room, person.seat);
    assert.equal(projected.round, 2);
    assert.equal(projected.game, null);
    assert.equal(projected.identity, null);
    assert.equal(projected.firstLeader, null);
    assert.ok(projected.players.every(player => !player.ready && !player.confirmed && !Object.hasOwn(player, "role")));
    assert.ok(!JSON.stringify(projected).includes("private-key-"));
  }
});

test("Duplicate rematches are harmless even after the next game starts, but require host authorization", () => {
  const room = finished();
  act(room, 1, "rematch");
  for (const advance of [() => {}, () => dealAgain(room), () => finish(room, false)]) {
    advance();
    const before = JSON.stringify(room);
    act(room, 1, "rematch", {round: 1});
    assert.equal(JSON.stringify(room), before);
    invalid(room, () => act(room, 2, "rematch", {round: 1}), 403);
    invalid(room, () => mutateRoom(room, "outsider", "rematch", {round: 1}), 403);
  }
  act(room, 1, "rematch", {round: 2});
  assert.equal(view(room).round, 3);
  invalid(room, () => act(room, 1, "rematch", {round: 1}), 409);
  const thirdLobby = JSON.stringify(room);
  act(room, 1, "rematch", {round: 2});
  assert.equal(JSON.stringify(room), thirdLobby);
});

test("Every stale or unversioned mutation is rejected after rematch, including existing-member join retries", () => {
  const room = finished();
  const oldTurn = room.game.proposals[0].id;
  act(room, 1, "rematch");
  const requests = [
    ["ready", {ready: true}], ["seat", {seat: 1}], ["leave", {}], ["start", {}],
    ["confirm", {}], ["begin", {}], ["join", {name: "旧页面", seat: 1}],
    ["propose", {turnId: oldTurn, team: [1, 2]}], ["vote", {turnId: oldTurn, approve: true}],
    ["quest", {turnId: oldTurn, card: "success"}], ["assassinate", {turnId: oldTurn, targetSeat: 2}],
  ];
  for (const [action, input] of requests) for (const round of [undefined, 1, 3]) {
    invalid(room, () => mutateRoom(room, player(room).key, action, {...input, round}), 409);
  }
  // Test stale start and begin at the exact phases where an unguarded request could advance the game.
  for (const person of room.players) act(room, person.seat, "ready", {ready: true});
  invalid(room, () => mutateRoom(room, player(room).key, "start", {}), 409);
  invalid(room, () => act(room, 1, "start", {round: 1}), 409);
  act(room, 1, "start");
  invalid(room, () => mutateRoom(room, player(room).key, "confirm", {}), 409);
  assert.ok(room.players.every(person => !person.confirmed));
  for (const person of room.players) act(room, person.seat, "confirm");
  invalid(room, () => mutateRoom(room, player(room).key, "begin", {}), 409);
  act(room, 1, "begin");
  const {turnId, leaderSeat} = view(room).game;
  act(room, leaderSeat, "propose", {turnId, team: [1, 2]});
  invalid(room, () => act(room, 1, "vote", {turnId: oldTurn, approve: true}), 409);
  invalid(room, () => act(room, 1, "quest", {turnId: oldTurn, card: "success"}), 409);
  assert.deepEqual(view(room).game.votedSeats, []);
});

test("The same room completes a second independent game with fresh hidden identities and its own result", () => {
  const room = finished();
  const oldTurnIds = new Set(room.game.proposals.map(proposal => proposal.id));
  assert.equal(view(room).game.result.winner, "evil");
  act(room, 1, "rematch");
  for (const person of room.players) act(room, person.seat, "ready", {ready: true});
  act(room, 1, "start");
  assert.equal(room.phase, "identity");
  assert.deepEqual(room.players.map(person => person.role).sort(), rolePool(5, "classic").sort());
  for (const person of room.players) {
    assert.equal(view(room, person.seat).identity.role, person.role);
    assert.equal(view(room, person.seat).game, null);
    act(room, person.seat, "confirm");
  }
  act(room, 1, "begin");
  assert.equal(view(room).game.revealedRoles, null);
  assert.deepEqual(view(room).game.quests, []);
  assert.deepEqual(view(room).game.proposals, []);
  assert.equal(view(room).game.result, null);
  finish(room, false);
  assert.equal(view(room).round, 2);
  assert.equal(view(room).game.result.reason, "assassin-missed");
  assert.equal(view(room).game.result.winner, "good");
  assert.equal(view(room).game.quests.length, 3);
  assert.ok(view(room).game.proposals.every(proposal => !oldTurnIds.has(proposal.id)));
  assert.equal(view(room).game.revealedRoles.length, 5);
  assert.equal(roomView(room, "outsider", 1).game, null);
});

test("The new lobby accepts round-aware roster changes and rejects stale attempts to fill a newly freed seat", () => {
  const room = finished();
  act(room, 1, "rematch");
  act(room, 5, "leave");
  for (const round of [undefined, 1]) {
    invalid(room, () => mutateRoom(room, "new-device", "join", {name: "新朋友", seat: 5, round}), 409);
  }
  mutateRoom(room, "new-device", "join", {name: "新朋友", seat: 5, round: 2});
  assert.equal(room.players.length, 5);
  assert.equal(player(room, 5).key, "new-device");
  assert.equal(player(room, 5).ready, false);
  assert.equal(player(room, 5).confirmed, false);
  assert.equal(player(room, 5).role, undefined);
});
