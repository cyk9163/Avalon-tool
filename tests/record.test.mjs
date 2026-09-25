import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool, ROLES} from "../lib/game.ts";
import {roomRecord} from "../lib/room-record.ts";
import {ROLE_INFO} from "../lib/role-info.ts";

function sample(capacity = 5, leaderSeat = capacity) {
  return {
    code: "123456", capacity, preset: "classic", phase: "ready", hostId: "p0", schemaVersion: 2,
    players: rolePool(capacity, "classic").map((role, i) => ({
      id: `p${i}`, key: `secret-${i}`, name: `玩家${i + 1}`, seat: i + 1, ready: true, confirmed: true, role,
    })),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000, requestId: "record-test", firstLeader: leaderSeat,
  };
}
const player = (room, seat) => room.players.find(p => p.seat === seat);
const view = (room, seat = 1) => roomView(room, player(room, seat).key, 1);
const act = (room, seat, action, input = {}) => mutateRoom(room, player(room, seat).key, action, {round: room.round ?? 1, ...input});

/** Three failed quests, so the game ends without an assassination. */
function failThreeQuests(room) {
  for (let quest = 0; quest < 3; quest++) {
    const {game} = view(room);
    const evil = room.players.find(p => ROLES[p.role].side === "evil").seat;
    const team = [evil, ...room.players.map(p => p.seat).filter(seat => seat !== evil)].slice(0, game.teamSize);
    act(room, game.leaderSeat, "propose", {turnId: game.turnId, team});
    for (const p of room.players) act(room, p.seat, "vote", {turnId: game.turnId, approve: true});
    for (const seat of team) act(room, seat, "quest", {turnId: game.turnId, card: seat === evil ? "fail" : "success"});
  }
  assert.equal(room.phase, "finished");
}
/** Deal and confirm again after a rematch. */
function dealAndBegin(room) {
  for (const p of room.players) act(room, p.seat, "ready", {ready: true, round: room.round});
  act(room, 1, "start", {round: room.round});
  for (const p of room.players) act(room, p.seat, "confirm", {round: room.round});
  act(room, 1, "begin", {round: room.round});
}

test("each finished game is recorded once, kept across rematches, and shown only to people who played it", () => {
  const room = sample();
  act(room, 1, "begin");
  assert.deepEqual(view(room).history, []);
  failThreeQuests(room);
  const first = view(room).history;
  assert.equal(first.length, 1);
  assert.deepEqual({round: first[0].round, winner: first[0].winner, reason: first[0].reason}, {round: 1, winner: "evil", reason: "three-failures"});
  assert.deepEqual(first[0].players.map(p => [p.seat, p.role, p.side]), room.players.map(p => [p.seat, p.role, ROLES[p.role].side]));
  assert.ok(!JSON.stringify(first).includes("secret-"), "no device keys in the record");
  assert.equal(roomView(room, "outsider", 1).history.length, 0, "visitors see nothing");

  act(room, 1, "rematch", {round: 1});
  assert.equal(view(room, 3).history.length, 1, "the record survives the rematch");
  // Seat 5 leaves and a newcomer takes it: the newcomer did not play game 1.
  act(room, 1, "kick", {targetPlayerId: player(room, 5).id, round: 2, hostRevision: 0});
  mutateRoom(room, "newcomer-key", "join", {name: "新人", seat: 5, round: 2});
  assert.equal(roomView(room, "newcomer-key", 1).history.length, 0, "a newcomer cannot see earlier games' roles");
  dealAndBegin(room);
  failThreeQuests(room);
  assert.equal(roomView(room, "newcomer-key", 1).history.length, 1);
  assert.equal(view(room, 1).history.length, 2);
  act(room, 1, "rematch", {round: 1});   // Retrying never records a game twice.
  assert.equal(view(room, 1).history.length, 2);
});

test("the room record counts wins by side and how often Merlin was found", () => {
  const players = (merlin, sides) => sides.map((side, index) => ({id: `p${index}`, name: `P${index}`, seat: index + 1, role: index === merlin ? "merlin" : side === "good" ? "loyal" : "minion", side}));
  const history = [
    {round: 1, winner: "evil", reason: "merlin-assassinated", players: players(0, ["good", "good", "evil"])},
    {round: 2, winner: "good", reason: "assassin-missed", players: players(1, ["evil", "good", "good"])},
    {round: 3, winner: "good", reason: "assassin-missed", players: players(0, ["good", "evil", "good"])},
  ];
  const record = roomRecord(history);
  assert.deepEqual([record.games, record.goodWins, record.evilWins], [3, 2, 1]);
  const p0 = record.players.find(row => row.id === "p0");
  assert.deepEqual([p0.games, p0.wins, p0.goodGames, p0.goodWins, p0.evilGames, p0.evilWins, p0.merlinGames, p0.merlinFound], [3, 1, 2, 1, 1, 0, 2, 1]);
  assert.equal(record.players[0].wins >= record.players.at(-1).wins, true, "sorted by wins");
  assert.deepEqual(roomRecord([]).players, []);
});

test("every role has an info card, and card rules match each side", () => {
  for (const role of Object.keys(ROLES)) {
    const info = ROLE_INFO[role];
    assert.ok(info && info.sees && info.seenBy && info.cards, role);
    if (ROLES[role].side === "good" && role !== "goodLancelot") assert.equal(info.cards, "只能出成功", role);
  }
  assert.equal(ROLE_INFO.oberon.sees, "没有人");
  assert.match(ROLE_INFO.merlin.sees, /莫德雷德/);
  assert.match(ROLE_INFO.mordred.seenBy, /梅林看不到你/);
});
