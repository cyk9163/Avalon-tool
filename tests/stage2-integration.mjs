import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Stage-two integration checks only run against a local server.");

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
      method: "POST", headers: {"Content-Type": "application/json", Origin: base, Cookie: this.cookie},
      body: JSON.stringify(body),
    });
    return {status: response.status, data: await response.json()};
  }
  async get(code) {
    const response = await fetch(`${base}/api/room?code=${code}`, {headers: {Cookie: this.cookie}});
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal(response.status, 200);
    return response.json();
  }
}
function ok(response) { assert.equal(response.status, 200, JSON.stringify(response)); return response.data; }
function rejected(response) { assert.ok(response.status >= 400 && response.status < 500, JSON.stringify(response)); }
async function setup() {
  const clients = await Promise.all(Array.from({length: 6}, () => new Client().init()));
  const created = ok(await clients[0].call({action: "create", name: "完整对局房主", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey}));
  const code = created.code;
  const calls = await Promise.all(clients.slice(1, 5).map((client, i) => client.call({action: "join", code, name: `流程玩家${i + 2}`, seat: i + 2})));
  calls.forEach(ok);
  (await Promise.all(clients.slice(0, 5).map(client => client.call({action: "ready", code, ready: true})))).forEach(ok);
  ok(await clients[0].call({action: "start", code}));
  const identities = await Promise.all(clients.slice(0, 5).map(client => client.get(code)));
  (await Promise.all(clients.slice(0, 5).map(client => client.call({action: "confirm", code})))).forEach(ok);
  const started = ok(await clients[0].call({action: "begin", code}));
  assert.equal(started.phase, "team");
  return {clients, code, identities, started};
}

for (const hitMerlin of [true, false]) {
  const {clients, code, identities} = await setup();
  const roles = identities.map((identity, index) => ({seat: index + 1, ...identity.identity}));
  const good = roles.filter(role => role.side === "good").map(role => role.seat);
  let previousTurn;
  for (let mission = 1; mission <= 3; mission++) {
    const before = await clients[0].get(code);
    assert.equal(before.game.quest, mission);
    const team = good.slice(0, before.game.teamSize);
    const turnId = before.game.turnId;
    const proposed = ok(await clients[before.game.leaderSeat - 1].call({action: "propose", code, turnId, team}));
    assert.equal(proposed.phase, "vote");
    if (previousTurn) {
      // A successfully delivered old request may be retried, but must never count toward this proposal.
      ok(await clients[0].call({action: "vote", code, turnId: previousTurn, approve: true}));
      assert.deepEqual((await clients[0].get(code)).game.votedSeats, []);
    }
    ok(await clients[0].call({action: "vote", code, turnId, approve: true, playerId: identities[1].meId}));
    const hidden = await clients[1].get(code);
    assert.deepEqual(hidden.game.votedSeats, [1]);
    assert.equal(hidden.game.myTeamVote, null);
    assert.equal(hidden.game.proposals.length, mission - 1);
    rejected(await clients[0].call({action: "vote", code, turnId, approve: false}));
    rejected(await clients[5].call({action: "vote", code, turnId, approve: true, playerId: identities[1].meId}));
    const ballots = await Promise.all([...clients.slice(1, 5), clients[4]].map(client => client.call({action: "vote", code, turnId, approve: true})));
    ballots.forEach(ok);
    const approved = await clients[0].get(code);
    assert.equal(approved.phase, "quest");
    assert.equal(approved.game.proposals.length, mission);
    assert.equal(approved.game.proposals.at(-1).votes.length, 5);
    const nonMember = roles.find(p => !team.includes(p.seat)).seat;
    rejected(await clients[nonMember - 1].call({action: "quest", code, turnId, card: "success"}));
    rejected(await clients[team[0] - 1].call({action: "quest", code, turnId, card: "fail"}));
    ok(await clients[team[0] - 1].call({action: "quest", code, turnId, card: "success"}));
    const partial = await clients[nonMember - 1].get(code);
    assert.equal(partial.game.submittedQuestCount, 1);
    assert.equal(partial.game.myQuestVote, null);
    assert.equal(partial.game.quests.length, mission - 1);
    assert.ok(!Object.hasOwn(partial.game, "questVotes"));
    assert.ok(!Object.hasOwn(partial.game, "failCount"));
    const lastSeat = team.at(-1);
    const cards = await Promise.all([...team.slice(1), lastSeat].map(seat => clients[seat - 1].call({action: "quest", code, turnId, card: "success"})));
    cards.forEach(ok);
    const settled = await clients[0].get(code);
    assert.equal(settled.game.quests.length, mission);
    assert.deepEqual(settled.game.quests.at(-1), {quest: mission, team, failCount: 0, success: true});
    assert.equal(settled.phase, mission === 3 ? "assassination" : "team");
    assert.equal(settled.game.revealedRoles, null);
    assert.equal((await clients[5].get(code)).game, null);
    previousTurn = turnId;
  }
  const assassin = roles.find(role => role.role === "assassin").seat;
  const target = roles.find(role => hitMerlin ? role.role === "merlin" : role.side === "good" && role.role !== "merlin").seat;
  const assassination = await clients[assassin - 1].get(code);
  const turnId = assassination.game.turnId;
  const nonAssassin = assassin === 1 ? 2 : 1;
  rejected(await clients[nonAssassin - 1].call({action: "assassinate", code, turnId, targetSeat: target}));
  const results = await Promise.all([0, 1].map(() => clients[assassin - 1].call({action: "assassinate", code, turnId, targetSeat: target})));
  results.forEach(ok);
  const finished = await clients[0].get(code);
  assert.equal(finished.phase, "finished");
  assert.equal(finished.game.result.winner, hitMerlin ? "evil" : "good");
  assert.equal(finished.game.result.reason, hitMerlin ? "merlin-assassinated" : "assassin-missed");
  assert.equal(finished.game.revealedRoles.length, 5);
  assert.deepEqual(finished.game.revealedRoles, roles.map(({seat, role}) => ({seat, role})));
  const outsider = await clients[5].get(code);
  assert.equal(outsider.game, null);
  assert.equal(outsider.identity, null);
  const otherTarget = roles.find(role => role.side === "good" && role.seat !== target).seat;
  rejected(await clients[assassin - 1].call({action: "assassinate", code, turnId, targetSeat: otherTarget}));
  console.log(`PASS complete 5-player game: concurrent votes/cards, stale retries, private cards, ${hitMerlin ? "Merlin assassinated" : "assassin missed"}, member-only role reveal`);
}

{
  const {clients, code} = await setup();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const before = await clients[0].get(code);
    const {turnId, leaderSeat} = before.game;
    ok(await clients[leaderSeat - 1].call({action: "propose", code, turnId, team: [1, 2]}));
    (await Promise.all(clients.slice(0, 5).map(client => client.call({action: "vote", code, turnId, approve: false})))).forEach(ok);
    const after = await clients[0].get(code);
    assert.equal(after.game.rejections, attempt);
    assert.equal(after.phase, "team");
  }
  const third = await clients[0].get(code);
  ok(await clients[third.game.leaderSeat - 1].call({action: "propose", code, turnId: third.game.turnId, team: [1, 2]}));
  const launched = await clients[0].get(code);
  assert.equal(launched.phase, "quest");
  assert.equal(launched.game.rejections, 0);
  assert.equal(launched.game.proposals.at(-1).approved, true);
  assert.deepEqual(launched.game.proposals.at(-1).votes, []);
  console.log("PASS complete 5-player game: the third team launches without a vote");
}
