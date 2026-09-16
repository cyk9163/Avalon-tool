import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Rematch integration checks only run against a local server.");

class Client {
  cookie = "";
  async init() {
    const response = await fetch(`${base}/api/room?session=1`);
    assert.equal(response.status, 200);
    this.cookie = response.headers.getSetCookie()[0].split(";")[0];
    return this;
  }
  async call(body) {
    const response = await fetch(`${base}/api/room`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Origin: base, Cookie: this.cookie},
      body: JSON.stringify(body),
    });
    return {status: response.status, data: await response.json()};
  }
  async get(code) {
    const response = await fetch(`${base}/api/room?code=${code}`, {headers: {Cookie: this.cookie}});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    return response.json();
  }
}
function ok(response) { assert.equal(response.status, 200, JSON.stringify(response)); return response.data; }
function rejected(response, status = 409) { assert.equal(response.status, status, JSON.stringify(response)); }

const clients = await Promise.all(Array.from({length: 6}, () => new Client().init()));
const members = clients.slice(0, 5), host = clients[0], outsider = clients[5];
const created = ok(await host.call({
  action: "create", name: "同房再局房主", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey,
}));
const code = created.code;
assert.equal(created.round, 1);
(await Promise.all(members.slice(1).map((client, index) => client.call({
  action: "join", code, name: `再局玩家${index + 2}`, seat: index + 2,
})))).forEach(ok);

async function readyAndBegin(round, legacy = false) {
  const version = legacy ? {} : {round};
  (await Promise.all(members.map(client => client.call({action: "ready", code, ready: true, ...version})))).forEach(ok);
  if (round > 1) {
    rejected(await host.call({action: "start", code}));
    rejected(await host.call({action: "start", code, round: round - 1}));
  }
  ok(await host.call({action: "start", code, ...version}));
  const identities = await Promise.all(members.map(client => client.get(code)));
  assert.ok(identities.every(identity => identity.round === round && identity.identity && identity.game === null));
  if (round > 1) {
    rejected(await members[1].call({action: "confirm", code}));
    rejected(await members[2].call({action: "confirm", code, round: round - 1}));
    assert.ok((await host.get(code)).players.every(player => !player.confirmed));
  }
  (await Promise.all(members.map(client => client.call({action: "confirm", code, ...version})))).forEach(ok);
  if (round > 1) rejected(await host.call({action: "begin", code}));
  const begun = ok(await host.call({action: "begin", code, ...version}));
  assert.equal(begun.phase, "team");
  assert.equal(begun.game.result, null);
  assert.equal(begun.game.revealedRoles, null);
  assert.deepEqual(begun.game.quests, []);
  assert.deepEqual(begun.game.proposals, []);
  return identities;
}

async function finishGame(round, identities, hitMerlin, previousTurn) {
  const turns = [];
  for (let mission = 1; mission <= 3; mission++) {
    const current = await host.get(code);
    const {turnId, leaderSeat, teamSize} = current.game;
    turns.push(turnId);
    const team = Array.from({length: teamSize}, (_, index) => index + 1);
    ok(await members[leaderSeat - 1].call({action: "propose", code, round, turnId, team}));
    if (previousTurn && mission === 1) {
      rejected(await members[0].call({action: "vote", code, round: round - 1, turnId: previousTurn, approve: true}));
      rejected(await members[0].call({action: "vote", code, round, turnId: previousTurn, approve: true}));
      rejected(await members[0].call({action: "quest", code, round, turnId: previousTurn, card: "success"}));
      assert.deepEqual((await host.get(code)).game.votedSeats, []);
    }
    (await Promise.all(members.map(client => client.call({action: "vote", code, round, turnId, approve: true})))).forEach(ok);
    assert.equal((await host.get(code)).phase, "quest");
    (await Promise.all(team.map(seat => members[seat - 1].call({action: "quest", code, round, turnId, card: "success"})))).forEach(ok);
    const settled = await host.get(code);
    assert.equal(settled.game.quests.length, mission);
    assert.equal(settled.game.revealedRoles, null);
    assert.equal(settled.game.myQuestVote, null);
    assert.ok(!JSON.stringify(settled).includes("questReceipts"));
    assert.ok(!JSON.stringify(settled).includes("questVotes"));
  }
  const assassin = identities.findIndex(identity => identity.identity.role === "assassin");
  const target = identities.findIndex(identity => hitMerlin
    ? identity.identity.role === "merlin" : identity.identity.role === "loyal") + 1;
  const current = await host.get(code);
  const finished = ok(await members[assassin].call({
    action: "assassinate", code, round, turnId: current.game.turnId, targetSeat: target,
  }));
  assert.equal(finished.phase, "finished");
  assert.equal(finished.round, round);
  assert.equal(finished.game.result.reason, hitMerlin ? "merlin-assassinated" : "assassin-missed");
  assert.equal(finished.game.proposals.length, 3);
  assert.equal(finished.game.quests.length, 3);
  assert.equal(finished.game.revealedRoles.length, 5);
  return {finished, turns};
}

const firstIdentities = await readyAndBegin(1, true);
rejected(await host.call({action: "rematch", code, round: 1}));
const first = await finishGame(1, firstIdentities, true);
rejected(await members[1].call({action: "rematch", code, round: 1}), 403);
rejected(await outsider.call({action: "rematch", code, round: 1, playerId: created.hostId}), 403);
rejected(await host.call({action: "rematch", code}), 400);

const duplicateRematches = await Promise.all(Array.from({length: 3}, () => host.call({action: "rematch", code, round: 1})));
duplicateRematches.forEach(response => {
  const rematched = ok(response);
  assert.equal(rematched.round, 2);
  assert.equal(rematched.phase, "lobby");
});
const resetViews = await Promise.all(members.map(client => client.get(code)));
for (const reset of resetViews) {
  assert.equal(reset.round, 2);
  for (const field of ["code", "capacity", "preset", "hostId", "expiresAt"]) assert.equal(reset[field], first.finished[field]);
  assert.equal(reset.identity, null);
  assert.equal(reset.game, null);
  assert.equal(reset.firstLeader, null);
  assert.deepEqual(reset.players, first.finished.players.map(player => ({...player, ready: false, confirmed: false})));
}
assert.equal((await outsider.get(code)).game, null);

const stale = await Promise.all([
  members[1].call({action: "ready", code, ready: true, round: 1}),
  members[2].call({action: "ready", code, ready: true}),
  host.call({action: "leave", code, round: 1}),
  host.call({action: "start", code, round: 1}),
  host.call({action: "join", code, name: "旧房主请求", seat: 1}),
]);
stale.forEach(response => rejected(response));
assert.deepEqual((await host.get(code)).players, resetViews[0].players);

const secondIdentities = await readyAndBegin(2);
const ongoing = await host.get(code);
const duplicateDuringGame = ok(await host.call({action: "rematch", code, round: 1}));
assert.equal(duplicateDuringGame.round, 2);
assert.equal(duplicateDuringGame.phase, "team");
assert.deepEqual(duplicateDuringGame.game, ongoing.game);
const second = await finishGame(2, secondIdentities, false, first.turns[0]);
assert.ok(second.turns.every(turnId => !first.turns.includes(turnId)));
assert.equal(second.finished.game.result.winner, "good");
assert.equal((await outsider.get(code)).game, null);
const duplicateAfterGame = ok(await host.call({action: "rematch", code, round: 1}));
assert.equal(duplicateAfterGame.round, 2);
assert.equal(duplicateAfterGame.phase, "finished");

(await Promise.all([0, 1].map(() => host.call({action: "rematch", code, round: 2})))).forEach(response => {
  assert.equal(ok(response).round, 3);
});
rejected(await host.call({action: "rematch", code, round: 1}));
assert.equal((await host.get(code)).round, 3);
console.log("PASS same-room rematch: two complete games, concurrent rematch retries, stale request isolation, fresh private identities, preserved roster, older retry rejection");
