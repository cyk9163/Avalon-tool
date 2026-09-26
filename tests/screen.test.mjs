import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool} from "../lib/game.ts";

const INVITE = "screen-invite-token-0001";
function sample() {
  return {
    code: "123456", capacity: 5, preset: "classic", phase: "ready", hostId: "p0", schemaVersion: 2, inviteToken: INVITE, ladyOfLake: false,
    players: rolePool(5, "classic").map((role, i) => ({
      id: `p${i}`, key: `secret-${i}`, name: `玩家${i + 1}`, seat: i + 1, ready: true, confirmed: true, role, recovery: `ABCDE${i}FGHJ`,
    })),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000, requestId: "screen-test", firstLeader: 5,
  };
}
const act = (room, seat, action, input = {}) => mutateRoom(room, `secret-${seat - 1}`, action, {round: 1, ...input});
const screen = (room, key = "table-tablet", invite = INVITE) => roomView(room, key, 1, invite, true);

test("the big screen gets the public game only with the room's invite token", () => {
  const room = sample();
  act(room, 1, "begin");
  assert.equal(screen(room, "tablet", null).game, null, "no invite, no game");
  assert.equal(screen(room, "tablet", "wrong-invite-token-000").game, null);
  assert.equal(roomView(room, "tablet", 1, INVITE).game, null, "without view=screen an invited visitor still sees no game");
  const view = screen(room);
  assert.equal(view.game.leaderSeat, 5);
  assert.deepEqual(view.game.speech.order, [5, 1, 2, 3, 4]);
  assert.equal(view.identity, null);
  assert.equal(view.game.myTeamVote, null);
  assert.deepEqual(view.game.allowedQuestCards, []);
  const legacy = {...sample(), inviteToken: undefined};
  act(legacy, 1, "begin");
  assert.equal(screen(legacy, "tablet", null).game, null, "rooms without an invite token have no big screen");
});

test("the big screen never shows roles or card owners, even after the game or on a member's device", () => {
  const room = sample();
  act(room, 1, "begin");
  let {game} = roomView(room, "secret-0", 1);
  act(room, game.leaderSeat, "propose", {turnId: game.turnId, team: [1, 2]});
  act(room, 1, "vote", {turnId: game.turnId, approve: true});
  assert.deepEqual(screen(room).game.votedSeats, [1], "who has voted is public");
  assert.equal(screen(room).game.proposals.length, 0, "votes stay hidden until everyone has voted");
  for (const seat of [2, 3, 4, 5]) act(room, seat, "vote", {turnId: game.turnId, approve: false});
  const evil = new Set(room.players.filter(player => player.role === "assassin" || player.role === "morgana").map(player => player.seat));
  for (let quest = 0; quest < 3; quest++) {
    ({game} = roomView(room, "secret-0", 1));
    const team = [...room.players.map(player => player.seat)].sort((a, b) => Number(evil.has(b)) - Number(evil.has(a))).slice(0, game.teamSize);
    act(room, game.leaderSeat, "propose", {turnId: game.turnId, team});
    if (room.phase === "vote") for (const seat of [1, 2, 3, 4, 5]) act(room, seat, "vote", {turnId: game.turnId, approve: true});
    ({game} = roomView(room, "secret-0", 1));
    for (const seat of game.team) act(room, seat, "quest", {turnId: game.turnId, card: evil.has(seat) ? "fail" : "success"});
  }
  assert.equal(room.phase, "finished");
  const member = roomView(room, "secret-0", 1, INVITE, true);
  for (const view of [screen(room), member]) {
    assert.equal(view.game.result.winner, "evil");
    assert.equal(view.game.revealedRoles, null);
    assert.equal(view.game.questCards, null);
    assert.equal(view.identity, null, "not even the device owner's own role");
    const text = JSON.stringify(view.game);
    for (const role of ["merlin", "assassin", "morgana", "percival"]) assert.ok(!text.includes(`"${role}"`), role);
  }
  assert.ok(roomView(room, "secret-0", 1).game.revealedRoles, "the member's normal view still reveals roles");
});
