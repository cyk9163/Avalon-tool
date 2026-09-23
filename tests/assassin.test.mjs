import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool, ROLES} from "../lib/game.ts";

// v1.0 house rule: with anytimeAssassin the assassin may strike once at any
// point of play; a hit wins for Evil, a miss wins for Good, either way it ends.
function sample(anytimeAssassin = true, capacity = 5) {
  return {
    code: "654321", capacity, preset: "classic", phase: "ready", hostId: "p0", ...(anytimeAssassin ? {anytimeAssassin} : {}),
    players: rolePool(capacity, "classic").map((role, i) => ({id: `p${i}`, key: `secret-${i}`, name: `玩家${i + 1}`, seat: i + 1, ready: true, confirmed: true, role})),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000, requestId: "assassin-test", firstLeader: capacity,
  };
}
const seatOf = (room, role) => room.players.find(p => p.role === role).seat;
const player = (room, seat) => room.players.find(p => p.seat === seat);
const view = (room, seat) => roomView(room, player(room, seat).key, 1);
const act = (room, seat, action, input = {}) => mutateRoom(room, player(room, seat).key, action, input);
function begin(anytime = true) { const room = sample(anytime); act(room, 1, "begin"); assert.equal(room.phase, "team"); return room; }
function strike(room, target, seat = seatOf(room, "assassin")) { act(room, seat, "assassinate", {turnId: room.game.turnId, targetSeat: target}); }

test("the option is exposed to every player and defaults to off for older rooms", () => {
  assert.equal(view(begin(true), 1).anytimeAssassin, true);
  assert.equal(view(begin(false), 1).anytimeAssassin, false);
});

test("an early hit on Merlin ends the game at once with an Evil win", () => {
  const room = begin();
  strike(room, seatOf(room, "merlin"));
  assert.equal(room.phase, "finished");
  const result = view(room, 1).game.result;
  assert.deepEqual(result, {winner: "evil", reason: "merlin-assassinated", targetSeat: seatOf(room, "merlin"), early: true});
  assert.equal(view(room, 1).game.revealedRoles.length, 5, "roles are revealed at the end as usual");
});

test("an early miss ends the game at once with a Good win, in any step of play", () => {
  for (const step of ["team", "vote", "quest"]) {
    const room = begin();
    const leader = view(room, 1).game.leaderSeat;
    if (step !== "team") {
      act(room, leader, "propose", {turnId: room.game.turnId, team: [1, 2]});
      if (step === "quest") for (const p of room.players) act(room, p.seat, "vote", {turnId: room.game.turnId, approve: true});
    }
    assert.equal(room.phase, step);
    const innocent = room.players.find(p => p.role !== "merlin" && p.role !== "assassin").seat;
    strike(room, innocent);
    assert.equal(room.phase, "finished", step);
    assert.deepEqual(view(room, 1).game.result, {winner: "good", reason: "assassin-missed", targetSeat: innocent, early: true});
  }
});

test("only the assassin may strike, never themselves, and only once", () => {
  const room = begin();
  const merlin = seatOf(room, "merlin"), assassin = seatOf(room, "assassin");
  const morgana = seatOf(room, "morgana");
  assert.throws(() => strike(room, merlin, morgana), /只有刺客/);
  assert.throws(() => strike(room, assassin), /其他玩家/);
  assert.equal(room.phase, "team");
  const turnId = room.game.turnId;
  strike(room, merlin);
  act(room, assassin, "assassinate", {turnId, targetSeat: merlin}); // a retried request is harmless
  assert.throws(() => act(room, assassin, "assassinate", {turnId, targetSeat: seatOf(room, "percival")}), /不能更换目标/);
  assert.equal(room.game.result.targetSeat, merlin);
});

test("without the rule, or before play starts, or with a stale turn, an early strike is refused", () => {
  const official = begin(false);
  const before = JSON.stringify(official);
  assert.throws(() => strike(official, seatOf(official, "merlin")), /还不能刺杀/);
  assert.equal(JSON.stringify(official), before);

  const waiting = sample(true);
  waiting.phase = "ready";
  assert.throws(() => act(waiting, seatOf(waiting, "assassin"), "assassinate", {turnId: "00000000-0000-4000-8000-000000000000", targetSeat: 1}), /开始任务|还不能/);

  const room = begin();
  const old = room.game.turnId;
  act(room, view(room, 1).game.leaderSeat, "propose", {turnId: old, team: [1, 2]});
  for (const p of room.players) act(room, p.seat, "vote", {turnId: old, approve: false});
  assert.notEqual(room.game.turnId, old, "a rejected team starts a new turn");
  assert.throws(() => act(room, seatOf(room, "assassin"), "assassinate", {turnId: old, targetSeat: seatOf(room, "merlin")}), /已结束/);
  assert.equal(room.phase, "team");
});

test("if nobody struck, three successes still lead to the final assassination", () => {
  const room = begin();
  const good = room.players.filter(p => ROLES[p.role].side === "good").map(p => p.seat);
  for (let quest = 0; quest < 3; quest++) {
    const current = view(room, 1).game;
    const team = good.slice(0, current.teamSize);
    act(room, current.leaderSeat, "propose", {turnId: current.turnId, team});
    for (const p of room.players) act(room, p.seat, "vote", {turnId: current.turnId, approve: true});
    for (const seat of team) act(room, seat, "quest", {turnId: current.turnId, card: "success"});
  }
  assert.equal(room.phase, "assassination");
  strike(room, seatOf(room, "percival"));
  assert.deepEqual(view(room, 1).game.result, {winner: "good", reason: "assassin-missed", targetSeat: seatOf(room, "percival")});
});
