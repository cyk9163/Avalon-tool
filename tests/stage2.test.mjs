import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, rolePool, ROLES} from "../lib/game.ts";

const missionSizes = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
function sample(capacity = 5, leaderSeat = capacity) {
  return {
    code: "123456", capacity, preset: "classic", phase: "ready", hostId: "p0",
    players: rolePool(capacity, "classic").map((role, i) => ({
      id: `p${i}`, key: `secret-${i}`, name: `玩家${i + 1}`, seat: i + 1,
      ready: true, confirmed: true, role,
    })),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000,
    requestId: "stage2-test", firstLeader: leaderSeat,
  };
}
function player(room, seat) { return room.players.find(p => p.seat === seat); }
function view(room, seat = 1) { return roomView(room, player(room, seat).key, 1); }
function game(room, seat = 1) { return view(room, seat).game; }
function act(room, seat, action, input = {}) {
  mutateRoom(room, player(room, seat).key, action, input);
}
function begin(capacity = 5, leaderSeat = capacity) {
  const room = sample(capacity, leaderSeat);
  act(room, 1, "begin");
  assert.equal(room.phase, "team");
  return room;
}
function propose(room, team) {
  const current = game(room);
  const forced = current.rejections >= 2;
  act(room, current.leaderSeat, "propose", {turnId: current.turnId, team});
  assert.equal(room.phase, forced ? "quest" : "vote");
  return current.turnId;
}
function voteAll(room, approve = true) {
  if (room.phase === "quest") return game(room).turnId;
  const {turnId} = game(room);
  for (const p of room.players) act(room, p.seat, "vote", {turnId, approve});
  return turnId;
}
function playMission(room, failCount = 0) {
  const current = game(room);
  const evil = room.players.filter(p => ROLES[p.role].side === "evil");
  const failing = evil.slice(0, failCount).map(p => p.seat);
  const team = [...failing, ...room.players.map(p => p.seat).filter(s => !failing.includes(s))].slice(0, current.teamSize);
  const turnId = propose(room, team);
  voteAll(room);
  assert.equal(room.phase, "quest");
  for (const seat of team) act(room, seat, "quest", {turnId, card: failing.includes(seat) ? "fail" : "success"});
  return {turnId, team};
}
function assertUnchanged(room, action) {
  const before = JSON.stringify(room);
  assert.throws(action);
  assert.equal(JSON.stringify(room), before, "invalid actions must not partially mutate state");
}

test("A ready legacy room starts once; only its host may begin after everyone confirms", () => {
  const room = sample();
  assertUnchanged(room, () => act(room, 2, "begin"));
  room.phase = "identity";
  room.players[4].confirmed = false;
  assertUnchanged(room, () => act(room, 1, "begin"));
  act(room, 5, "confirm");
  assert.equal(room.phase, "ready");
  act(room, 1, "begin");
  const started = JSON.stringify(room);
  act(room, 1, "begin");
  assert.equal(JSON.stringify(room), started);
  assert.equal(game(room).leaderSeat, 5);
  assert.equal(game(room).quest, 1);
});

test("All 5–10 player games use the published mission sizes and failure thresholds", () => {
  for (let capacity = 5; capacity <= 10; capacity++) {
    const room = begin(capacity);
    for (let quest = 1; quest <= 5; quest++) {
      const current = game(room);
      assert.equal(current.quest, quest);
      assert.equal(current.teamSize, missionSizes[capacity][quest - 1]);
      assert.equal(current.failsRequired, capacity >= 7 && quest === 4 ? 2 : 1);
      if (quest < 5) playMission(room, quest % 2 === 0 ? current.failsRequired : 0);
    }
  }
});

test("Only the current leader can propose a unique team of the required existing seats", () => {
  const room = begin();
  const {turnId, leaderSeat} = game(room);
  for (const team of [[], [1], [1, 2, 3], [1, 1], [0, 2], [1, 6], [1, 2.5], [1, "2"], "1,2", null]) {
    assertUnchanged(room, () => act(room, leaderSeat, "propose", {turnId, team}));
  }
  assertUnchanged(room, () => act(room, 1, "propose", {turnId, team: [1, 2]}));
  assertUnchanged(room, () => act(room, leaderSeat, "propose", {turnId: "stale", team: [1, 2]}));
  propose(room, [1, 2]);
  assertUnchanged(room, () => act(room, leaderSeat, "propose", {turnId, team: [2, 3]}));
});

test("Team votes belong to the cookie owner, are immutable, and stay secret until all submit", () => {
  const room = begin();
  const turnId = propose(room, [1, 2]);
  act(room, 1, "vote", {turnId, approve: true, playerId: "p1", seat: 2});
  assert.deepEqual(game(room).votedSeats, [1]);
  assert.equal(game(room, 1).myTeamVote, true);
  assert.equal(game(room, 2).myTeamVote, null);
  assert.deepEqual(game(room, 2).proposals, []);
  for (const key of ["votes", "teamVotes", "questVotes", "receipts"]) assert.ok(!(key in game(room, 2)));
  const afterFirst = JSON.stringify(room);
  act(room, 1, "vote", {turnId, approve: true});
  assert.equal(JSON.stringify(room), afterFirst);
  assertUnchanged(room, () => act(room, 1, "vote", {turnId, approve: false}));
  assertUnchanged(room, () => act(room, 2, "vote", {turnId, approve: "yes"}));
  assertUnchanged(room, () => mutateRoom(room, "outsider", "vote", {turnId, approve: true, playerId: "p1"}));
  for (const seat of [2, 3, 4, 5]) act(room, seat, "vote", {turnId, approve: seat <= 3});
  assert.equal(room.phase, "quest");
  assert.deepEqual(game(room).proposals[0].votes, [1, 2, 3, 4, 5].map(seat => ({seat, approve: seat <= 3})));
});

test("A strict majority is required; a tie rejects, rotating and wrapping the leader", () => {
  const room = begin(6, 6);
  const turnId = propose(room, [1, 2]);
  for (const p of room.players) act(room, p.seat, "vote", {turnId, approve: p.seat <= 3});
  assert.equal(room.phase, "team");
  assert.equal(game(room).leaderSeat, 1);
  assert.equal(game(room).rejections, 1);
  assert.equal(game(room).quest, 1);
  assert.notEqual(game(room).turnId, turnId);
  const next = propose(room, [1, 2]);
  for (const p of room.players) act(room, p.seat, "vote", {turnId: next, approve: p.seat <= 4});
  assert.equal(room.phase, "quest");
});

test("the third team of a quest launches without a vote", () => {
  const room = begin();
  for (let attempt = 1; attempt <= 2; attempt++) {
    propose(room, [1, 2]);
    voteAll(room, false);
    assert.equal(room.phase, "team");
    assert.equal(game(room).rejections, attempt);
    assert.equal(game(room).proposals.length, attempt);
  }
  propose(room, [1, 2]);
  assert.equal(room.phase, "quest");
  assert.equal(game(room).rejections, 0);
  assert.equal(game(room).quests.length, 0);
  const forced = game(room).proposals.at(-1);
  assert.equal(forced.attempt, 3);
  assert.equal(forced.approved, true);
  assert.deepEqual(forced.votes, []);
  assert.equal(game(room).result, null);
});

test("Only quest members submit cards; good players cannot fail and hidden cards never identify their authors", () => {
  const room = begin();
  const evilSeat = room.players.find(p => ROLES[p.role].side === "evil").seat;
  const turnId = propose(room, [1, evilSeat]);
  voteAll(room);
  assertUnchanged(room, () => act(room, 1, "quest", {turnId, card: "fail"}));
  assertUnchanged(room, () => act(room, 2, "quest", {turnId, card: "success"}));
  assertUnchanged(room, () => act(room, 1, "quest", {turnId, card: "invalid"}));
  assertUnchanged(room, () => mutateRoom(room, "outsider", "quest", {turnId, card: "success", seat: 1}));
  act(room, evilSeat, "quest", {turnId, card: "fail", seat: 1});
  assert.equal(game(room, evilSeat).myQuestVote, "fail");
  assert.equal(game(room, 1).myQuestVote, null);
  assert.equal(game(room, 2).submittedQuestCount, 1);
  assert.deepEqual(game(room, 2).quests, []);
  assertUnchanged(room, () => act(room, evilSeat, "quest", {turnId, card: "success"}));
  const partial = JSON.stringify(room);
  act(room, evilSeat, "quest", {turnId, card: "fail"});
  assert.equal(JSON.stringify(room), partial);
  act(room, 1, "quest", {turnId, card: "success"});
  assert.equal(room.phase, "team");
  const result = game(room).quests[0];
  assert.deepEqual(Object.keys(result).sort(), ["failCount", "quest", "success", "team"]);
  assert.equal(result.failCount, 1);
  assert.equal(result.success, false);
  assert.equal(game(room).leaderSeat, 1);
  assert.equal(game(room).rejections, 0);
  assert.equal(game(room).myQuestVote, null);
  assert.equal(game(room).submittedQuestCount, 0);
});

test("The fourth mission for seven or more players needs two failure cards", () => {
  for (const capacity of [7, 8, 9, 10]) for (const failCount of [1, 2]) {
    const room = begin(capacity);
    playMission(room, 0);
    playMission(room, 1);
    playMission(room, 0);
    playMission(room, failCount);
    const result = game(room).quests[3];
    assert.equal(result.failCount, failCount);
    assert.equal(result.success, failCount === 1);
    assert.equal(room.phase, failCount === 1 ? "assassination" : "team");
  }
});

test("An approved quest resets the rejection streak and the leader rotates after the quest", () => {
  const room = begin();
  for (let i = 0; i < 2; i++) { propose(room, [1, 2]); voteAll(room, false); }
  assert.equal(game(room).rejections, 2);
  assert.equal(game(room).leaderSeat, 2);
  playMission(room);
  assert.equal(game(room).rejections, 0);
  assert.equal(game(room).leaderSeat, 3);
  assert.equal(game(room).quest, 2);
});

test("Three failed missions end immediately for evil without an assassination", () => {
  const room = begin();
  for (let i = 0; i < 3; i++) playMission(room, 1);
  assert.equal(room.phase, "finished");
  assert.deepEqual(game(room).result, {winner: "evil", reason: "three-failures"});
  assert.equal(game(room).quests.filter(q => !q.success).length, 3);
  assertUnchanged(room, () => act(room, 1, "propose", {turnId: game(room).turnId, team: [1, 2]}));
});

test("The fifth mission always needs only one failure, including seven or more players", () => {
  for (const capacity of [7, 10]) {
    const room = begin(capacity);
    playMission(room, 0);
    playMission(room, 1);
    playMission(room, 0);
    playMission(room, 2);
    playMission(room, 1);
    assert.equal(game(room).quests[4].success, false);
    assert.deepEqual(game(room).result, {winner: "evil", reason: "three-failures"});
  }
});

test("Three successes expose no roles until the assassin chooses: Merlin hit and missed outcomes", () => {
  for (const hitMerlin of [true, false]) {
    const room = begin();
    for (let i = 0; i < 3; i++) playMission(room);
    assert.equal(room.phase, "assassination");
    assert.equal(game(room).revealedRoles, null);
    assert.equal(game(room).result, null);
    const assassin = room.players.find(p => p.role === "assassin");
    const target = room.players.find(p => hitMerlin ? p.role === "merlin" : ROLES[p.role].side === "good" && p.role !== "merlin");
    const {turnId} = game(room);
    assertUnchanged(room, () => act(room, 1, "assassinate", {turnId, targetSeat: target.seat}));
    for (const targetSeat of [0, 6, 1.2, "1", assassin.seat]) {
      assertUnchanged(room, () => act(room, assassin.seat, "assassinate", {turnId, targetSeat}));
    }
    assertUnchanged(room, () => act(room, assassin.seat, "assassinate", {turnId: "stale", targetSeat: target.seat}));
    act(room, assassin.seat, "assassinate", {turnId, targetSeat: target.seat});
    assert.equal(room.phase, "finished");
    assert.deepEqual(game(room).result, {winner: hitMerlin ? "evil" : "good", reason: hitMerlin ? "merlin-assassinated" : "assassin-missed", targetSeat: target.seat});
    for (const p of room.players) {
      const projected = view(room, p.seat);
      assert.equal(projected.game.revealedRoles.length, room.capacity);
      assert.deepEqual(projected.game.revealedRoles, room.players.map(({seat, role}) => ({seat, role})));
      assert.ok(projected.players.every(p => !("role" in p) && !("key" in p)));
      assert.ok(!JSON.stringify(projected).includes("secret-"));
    }
    assert.equal(roomView(room, "outsider", 1).game, null);
    const final = JSON.stringify(room);
    act(room, assassin.seat, "assassinate", {turnId, targetSeat: target.seat});
    assert.equal(JSON.stringify(room), final);
    const otherGood = room.players.find(p => ROLES[p.role].side === "good" && p.seat !== target.seat);
    assertUnchanged(room, () => act(room, assassin.seat, "assassinate", {turnId, targetSeat: otherGood.seat}));
  }
});

test("Choosing another evil player, including Oberon, consumes the assassination without an identity oracle", () => {
  for (const targetRole of ["morgana", "oberon"]) {
    const room = sample(10);
    room.preset = "full";
    rolePool(10, "full").forEach((role, i) => { room.players[i].role = role; });
    act(room, 1, "begin");
    for (let i = 0; i < 3; i++) playMission(room);
    const assassin = room.players.find(p => p.role === "assassin");
    const target = room.players.find(p => p.role === targetRole);
    act(room, assassin.seat, "assassinate", {turnId: game(room).turnId, targetSeat: target.seat});
    assert.equal(room.phase, "finished");
    assert.deepEqual(game(room).result, {winner: "good", reason: "assassin-missed", targetSeat: target.seat});
  }
});

test("Late stage-one retries preserve the active round, assigned identities, and first leader", () => {
  const room = begin();
  const identities = room.players.map(p => p.role);
  const firstLeader = room.firstLeader;
  propose(room, [1, 2]);
  const before = JSON.stringify(room);
  act(room, 1, "start");
  act(room, 1, "confirm");
  act(room, 1, "begin");
  assert.equal(JSON.stringify(room), before);
  assert.deepEqual(room.players.map(p => p.role), identities);
  assert.equal(room.firstLeader, firstLeader);
});

test("Final ballot/card retries cannot advance twice, and old turn requests cannot vote in a new round", () => {
  const room = begin();
  const firstTurn = propose(room, [1, 2]);
  voteAll(room);
  const votingFinished = JSON.stringify(room);
  act(room, 5, "vote", {turnId: firstTurn, approve: true});
  assert.equal(JSON.stringify(room), votingFinished);
  act(room, 1, "quest", {turnId: firstTurn, card: "success"});
  act(room, 2, "quest", {turnId: firstTurn, card: "success"});
  const questFinished = JSON.stringify(room);
  act(room, 2, "quest", {turnId: firstTurn, card: "success"});
  assert.equal(JSON.stringify(room), questFinished);
  assertUnchanged(room, () => act(room, 2, "quest", {turnId: firstTurn, card: "fail"}));
  const nextTurn = propose(room, [1, 2, 3]);
  assert.notEqual(nextTurn, firstTurn);
  act(room, 5, "vote", {turnId: firstTurn, approve: true});
  assert.deepEqual(game(room).votedSeats, []);
  assertUnchanged(room, () => act(room, 5, "vote", {turnId: firstTurn, approve: false}));
  assertUnchanged(room, () => act(room, 5, "vote", {turnId: "unknown-turn", approve: true}));
  assert.equal(game(room).myTeamVote, null);
  assert.equal(game(room).myQuestVote, null);
});

test("Outsiders never receive in-progress or final game details", () => {
  const room = begin();
  for (const step of [() => {}, () => propose(room, [1, 2]), () => voteAll(room), () => {
    const turnId = game(room).turnId;
    act(room, 1, "quest", {turnId, card: "success"});
    act(room, 2, "quest", {turnId, card: "success"});
  }]) {
    step();
    const outsider = roomView(room, "outsider", 1);
    assert.equal(outsider.identity, null);
    assert.equal(outsider.meId, null);
    assert.equal(outsider.game, null);
  }
});

test("Quest cards stay secret during play and are revealed to the game's members once it ends", () => {
  const room = begin();
  const evil = room.players.filter(p => ROLES[p.role].side === "evil").map(p => p.seat);
  const played = [];
  for (let mission = 0; mission < 3; mission++) {
    const {team} = playMission(room, 1);
    played.push({team, failing: evil.filter(seat => team.includes(seat)).slice(0, 1)});
    if (room.phase !== "finished") {
      for (const p of room.players) assert.equal(game(room, p.seat).questCards, null, "no card authors while the game is running");
      assert.ok(!JSON.stringify(view(room, 1)).includes('"card"'));
    }
  }
  assert.equal(room.phase, "finished");
  for (const p of room.players) {
    const cards = game(room, p.seat).questCards;
    assert.equal(cards.length, 3);
    cards.forEach((quest, index) => {
      assert.equal(quest.quest, index + 1);
      assert.deepEqual(quest.cards.map(item => item.seat), [...played[index].team].sort((a, b) => a - b));
      for (const {seat, card} of quest.cards) assert.equal(card, played[index].failing.includes(seat) ? "fail" : "success");
    });
  }
  assert.equal(roomView(room, "outsider", 1).game, null, "people outside the game see no cards");
});

test("The leader can show a team, change or withdraw it while everyone talks, and only then call the vote", () => {
  const room = begin();
  const leaderSeat = game(room).leaderSeat, other = leaderSeat % 5 + 1, turnId = game(room).turnId;
  assertUnchanged(room, () => act(room, other, "draft", {turnId, team: [1, 2]}));
  assertUnchanged(room, () => act(room, leaderSeat, "draft", {turnId, team: [1, 2, 3]}));   // more than the team size
  assertUnchanged(room, () => act(room, leaderSeat, "draft", {turnId, team: [1, 1]}));
  assertUnchanged(room, () => act(room, leaderSeat, "draft", {turnId: "00000000-0000-4000-8000-000000000000", team: [1]}));
  act(room, leaderSeat, "draft", {turnId, team: [2, 1]});
  assert.equal(room.phase, "team", "showing a team does not start the vote");
  for (const p of room.players) assert.deepEqual(game(room, p.seat).draftTeam, [1, 2], "everyone sees the shown team");
  act(room, leaderSeat, "draft", {turnId, team: [3, 4]});
  assert.deepEqual(game(room, other).draftTeam, [3, 4], "the leader can change it");
  act(room, leaderSeat, "draft", {turnId, team: []});
  assert.deepEqual(game(room, other).draftTeam, [], "and withdraw it");
  act(room, leaderSeat, "draft", {turnId, team: [4, 5]});
  act(room, leaderSeat, "propose", {turnId, team: [4, 5]});
  assert.equal(room.phase, "vote");
  assert.deepEqual(game(room, other).draftTeam, [], "the draft is gone once the vote starts");
  assertUnchanged(room, () => act(room, leaderSeat, "draft", {turnId, team: [1, 2]}));
  for (const p of room.players) act(room, p.seat, "vote", {turnId, approve: false});
  assert.equal(room.phase, "team");
  assert.deepEqual(game(room, 1).draftTeam, [], "the next leader starts without a draft");
});
