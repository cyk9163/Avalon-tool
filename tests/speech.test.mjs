import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool, speakingOrder} from "../lib/game.ts";
import {myTurn} from "../lib/turn.ts";

function sample(capacity = 5, leaderSeat = capacity) {
  return {
    code: "123456", capacity, preset: "classic", phase: "ready", hostId: "p0",
    players: rolePool(capacity, "classic").map((role, i) => ({
      id: `p${i}`, key: `secret-${i}`, name: `玩家${i + 1}`, seat: i + 1, ready: true, confirmed: true, role,
    })),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000, requestId: "speech-test", firstLeader: leaderSeat,
  };
}
const player = (room, seat) => room.players.find(p => p.seat === seat);
const view = (room, seat = 1) => roomView(room, player(room, seat).key, 1);
const game = (room, seat = 1) => view(room, seat).game;
const act = (room, seat, action, input = {}) => mutateRoom(room, player(room, seat).key, action, input);
function assertUnchanged(room, action) {
  const before = JSON.stringify(room);
  assert.throws(action);
  assert.equal(JSON.stringify(room), before, "invalid actions must not partially mutate state");
}
function begin(capacity = 5, leaderSeat = capacity) {
  const room = sample(capacity, leaderSeat);
  act(room, 1, "begin");
  return room;
}

test("the speaking order starts with the leader and goes round the table", () => {
  assert.deepEqual(speakingOrder({capacity: 5}, 5), [5, 1, 2, 3, 4]);
  assert.deepEqual(speakingOrder({capacity: 7}, 3), [3, 4, 5, 6, 7, 1, 2]);
  const room = begin();
  const speech = game(room, 2).speech;
  assert.deepEqual(speech.order, [5, 1, 2, 3, 4]);
  assert.equal(speech.index, 0);
  assert.equal(speech.seconds, 90, "a 90 second soft timer by default");
  assert.ok(Math.abs(speech.now - Date.now()) < 5000 && speech.startedAt <= speech.now);
  for (const p of room.players) assert.deepEqual(game(room, p.seat).speech.order, speech.order, "everyone sees the same order");
});

test("the speaker, the leader or the host pass the floor on; others cannot; repeats are harmless", () => {
  const room = begin();                 // leader 5, host seat 1
  const {turnId} = game(room);
  assertUnchanged(room, () => act(room, 2, "speech", {turnId, step: "next", index: 0}));   // not the speaker, leader or host
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "next", index: 3}));   // wrong index
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "shout"}));
  assertUnchanged(room, () => act(room, 5, "speech", {turnId: "00000000-0000-4000-8000-000000000000", step: "next", index: 0}));
  act(room, 5, "speech", {turnId, step: "next", index: 0});      // the leader finishes
  assert.equal(game(room).speech.index, 1);
  act(room, 5, "speech", {turnId, step: "next", index: 0});      // a retry changes nothing
  assert.equal(game(room).speech.index, 1);
  act(room, 1, "speech", {turnId, step: "next", index: 1});      // seat 1 speaks and is done
  assertUnchanged(room, () => act(room, 3, "speech", {turnId, step: "next", index: 2}));   // seat 3 cannot skip seat 2
  act(room, 2, "speech", {turnId, step: "next", index: 2});
  act(room, 1, "speech", {turnId, step: "next", index: 3});      // the host skips an absent seat 3
  act(room, 4, "speech", {turnId, step: "next", index: 4});
  assert.equal(game(room).speech.index, 5, "everyone has spoken");
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "next", index: 5}));
  assertUnchanged(room, () => act(room, 3, "speech", {turnId, step: "restart"}));
  act(room, 5, "speech", {turnId, step: "restart"});
  assert.equal(game(room).speech.index, 0, "the leader can start another round");
});

test("the leader or host sets the timer, which carries over to later turns", () => {
  const room = begin();
  const {turnId} = game(room);
  assertUnchanged(room, () => act(room, 3, "speech", {turnId, step: "timer", seconds: 60}));
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "timer", seconds: 45}));
  act(room, 5, "speech", {turnId, step: "timer", seconds: 0});
  assert.equal(game(room).speech.seconds, 0);
  act(room, 1, "speech", {turnId, step: "timer", seconds: 120});
  act(room, 5, "propose", {turnId, team: [1, 2]});
  assert.equal(game(room).speech, null, "no speaking order once the vote starts");
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "next", index: 0}));
  for (const p of room.players) act(room, p.seat, "vote", {turnId, approve: false});
  const next = game(room).speech;
  assert.deepEqual(next.order, [1, 2, 3, 4, 5], "the new leader speaks first");
  assert.equal(next.index, 0);
  assert.equal(next.seconds, 120);
});

test("an in-person room skips the speaking order and votes after the team is shown", () => {
  const room = sample();
  room.turnSpeech = false;
  act(room, 1, "begin");
  assert.equal(game(room).speech, null);
  assert.equal(view(room, 1).turnSpeech, false);
  const {turnId} = game(room);
  assertUnchanged(room, () => act(room, 5, "speech", {turnId, step: "next", index: 0}));
  act(room, 5, "propose", {turnId, team: [1, 2]});
  assert.equal(room.phase, "vote");
});

test("myTurn names the move each player owes", () => {
  const room = begin();
  const {turnId} = game(room);
  const turn = seat => myTurn(view(room, seat));
  assert.equal(turn(5), "轮到你发言", "the leader speaks first");
  assert.equal(turn(1), null);
  act(room, 5, "speech", {turnId, step: "next", index: 0});
  assert.equal(turn(5), "轮到你选队");
  assert.equal(turn(1), "轮到你发言");
  act(room, 5, "propose", {turnId, team: [1, 2]});
  assert.equal(turn(3), "轮到你投票");
  act(room, 3, "vote", {turnId, approve: true});
  assert.equal(turn(3), null);
  for (const seat of [1, 2, 4, 5]) act(room, seat, "vote", {turnId, approve: true});
  assert.equal(room.phase, "quest");
  assert.equal(turn(1), "轮到你出任务牌");
  assert.equal(turn(3), null, "only the team plays cards");
  assert.equal(myTurn({...view(room, 1), meId: null}), null, "visitors have no move");
});
