import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Room-management integration checks only run against a local server.");

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
function rejected(response, status) {
  if (status) assert.equal(response.status, status, JSON.stringify(response));
  else assert.ok(response.status >= 400 && response.status < 500, JSON.stringify(response));
}
function body(room, action, fields = {}) {
  return {action, code: room.code, round: room.round, hostRevision: room.hostRevision, ...fields};
}
async function setup() {
  const clients = await Promise.all(Array.from({length: 7}, () => new Client().init()));
  const created = ok(await clients[0].call({
    action: "create", name: "管理功能测试房主", capacity: 5, preset: "classic", requestId: crypto.randomUUID(),
  }));
  assert.equal(created.hostRevision, 0);
  const code = created.code;
  (await Promise.all(clients.slice(1, 5).map((client, index) => client.call({
    action: "join", code, round: 1, name: `管理玩家${index + 2}`, seat: index + 2,
  })))).forEach(ok);
  return {clients, members: clients.slice(0, 5), code, room: await clients[0].get(code)};
}
async function readyAll(members, room) {
  (await Promise.all(members.map(client => client.call(body(room, "ready", {ready: true}))))).forEach(ok);
}
async function dealAndBegin(members, host, room) {
  await readyAll(members, room);
  ok(await host.call(body(room, "start")));
  const identities = await Promise.all(members.map(client => client.get(room.code)));
  (await Promise.all(members.map(client => client.call(body(room, "confirm"))))).forEach(ok);
  ok(await host.call(body(room, "begin")));
  return identities;
}

{
  const {clients, members, code, room} = await setup();
  const originalHost = clients[0], newHost = clients[1], replacement = clients[5], outsider = clients[6];
  const oldTargetId = room.players.find(player => player.seat === 5).id;
  const newHostId = room.players.find(player => player.seat === 2).id;
  await dealAndBegin(members, originalHost, room);
  const oldGame = await originalHost.get(code);
  const oldTurnId = oldGame.game.turnId;
  const oldTeam = [1, 2];
  ok(await members[oldGame.game.leaderSeat - 1].call(body(oldGame, "propose", {turnId: oldTurnId, team: oldTeam})));
  (await Promise.all(members.map(client => client.call(body(oldGame, "vote", {turnId: oldTurnId, approve: true}))))).forEach(ok);
  ok(await members[0].call(body(oldGame, "quest", {turnId: oldTurnId, card: "success"})));
  const transferRequest = body(oldGame, "transfer-host", {targetPlayerId: newHostId});
  const transferred = ok(await originalHost.call(transferRequest));
  assert.equal(transferred.hostId, newHostId);
  assert.equal(transferred.hostRevision, 1);
  assert.equal(transferred.phase, "quest");
  assert.equal(transferred.game.submittedQuestCount, 1);
  ok(await originalHost.call(transferRequest));
  const abortRequest = body(transferred, "abort");
  rejected(await originalHost.call(abortRequest), 403);
  rejected(await outsider.call({...abortRequest, playerId: newHostId}), 403);
  (await Promise.all([0, 1, 2].map(() => newHost.call(abortRequest)))).forEach(response => {
    const aborted = ok(response);
    assert.equal(aborted.round, 2);
    assert.equal(aborted.phase, "lobby");
    assert.equal(aborted.resetReason, "abort");
  });
  const reset = await newHost.get(code);
  assert.equal(reset.hostId, newHostId);
  assert.equal(reset.hostRevision, 1);
  assert.equal(reset.expiresAt, room.expiresAt);
  for (const client of members) {
    const projected = await client.get(code);
    assert.equal(projected.identity, null);
    assert.equal(projected.game, null);
    assert.equal(projected.firstLeader, null);
    assert.ok(projected.players.every(player => !player.ready && !player.confirmed));
  }
  rejected(await originalHost.call(transferRequest), 403);
  rejected(await members[0].call(body(oldGame, "quest", {turnId: oldTurnId, card: "success"})), 409);
  const kickRequest = body(reset, "kick", {targetPlayerId: oldTargetId});
  ok(await newHost.call(kickRequest));
  assert.equal((await newHost.get(code)).players.length, 4);
  const joined = ok(await replacement.call(body(reset, "join", {name: "替补朋友", seat: 5})));
  assert.notEqual(joined.meId, oldTargetId);
  ok(await newHost.call(kickRequest));
  assert.equal((await newHost.get(code)).players.find(player => player.seat === 5).id, joined.meId);
  const removedClient = members[4];
  members[4] = replacement;
  const identities = await dealAndBegin(members, newHost, reset);
  rejected(await removedClient.call(body(reset, "confirm")), 403);
  assert.equal((await removedClient.get(code)).identity, null);

  for (let quest = 1; quest <= 3; quest++) {
    const current = await newHost.get(code);
    const {turnId, leaderSeat, teamSize} = current.game;
    const team = Array.from({length: teamSize}, (_, index) => index + 1);
    ok(await members[leaderSeat - 1].call(body(current, "propose", {turnId, team})));
    if (quest === 1) {
      rejected(await members[0].call(body(current, "vote", {turnId: oldTurnId, approve: true})), 409);
      // The previous-round abort retry races all current-round votes; it must not reset the new game.
      const responses = await Promise.all([
        newHost.call(abortRequest),
        ...members.map(client => client.call(body(current, "vote", {turnId, approve: true}))),
      ]);
      responses.forEach(ok);
    } else {
      (await Promise.all(members.map(client => client.call(body(current, "vote", {turnId, approve: true}))))).forEach(ok);
    }
    const approved = await newHost.get(code);
    assert.equal(approved.phase, "quest");
    assert.equal(approved.round, 2);
    assert.equal(approved.game.proposals.length, quest);
    (await Promise.all(team.map(seat => members[seat - 1].call(body(current, "quest", {turnId, card: "success"}))))).forEach(ok);
  }
  const assassin = identities.findIndex(identity => identity.identity.role === "assassin");
  const loyalSeat = identities.findIndex(identity => identity.identity.role === "loyal") + 1;
  const last = await newHost.get(code);
  const finished = ok(await members[assassin].call(body(last, "assassinate", {turnId: last.game.turnId, targetSeat: loyalSeat})));
  assert.equal(finished.phase, "finished");
  assert.equal(finished.round, 2);
  assert.equal(finished.hostId, newHostId);
  assert.equal(finished.game.result.winner, "good");
  assert.equal(finished.game.quests.length, 3);
  assert.equal((await removedClient.get(code)).game, null);
  assert.equal((await outsider.get(code)).game, null);
  console.log("PASS room management: transfer during a private quest, concurrent abort retries, stable-ID kick/replacement, stale request isolation and a complete fresh game");
}

{
  const {clients, members, room} = await setup();
  await readyAll(members, room);
  const targetPlayerId = room.players.find(player => player.seat === 5).id;
  const [kick, start] = await Promise.all([
    clients[0].call(body(room, "kick", {targetPlayerId})),
    clients[0].call(body(room, "start")),
  ]);
  assert.equal([kick, start].filter(response => response.status === 200).length, 1);
  const final = await clients[0].get(room.code);
  if (kick.status === 200) {
    rejected(start, 409);
    assert.equal(final.phase, "lobby");
    assert.equal(final.players.length, 4);
    assert.equal(final.identity, null);
  } else {
    rejected(kick, 409);
    assert.equal(final.phase, "identity");
    assert.equal(final.players.length, 5);
    assert.ok(final.identity);
  }
  console.log("PASS concurrent kick versus deal: exactly one operation wins and no partial game starts");
}

{
  const {clients, room} = await setup();
  const targets = [2, 3].map(seat => room.players.find(player => player.seat === seat).id);
  const requests = targets.map(targetPlayerId => body(room, "transfer-host", {targetPlayerId}));
  const responses = await Promise.all(requests.map(request => clients[0].call(request)));
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  responses.filter(response => response.status !== 200).forEach(response => rejected(response));
  const winnerIndex = responses.findIndex(response => response.status === 200);
  const changed = await clients[0].get(room.code);
  assert.equal(changed.hostId, targets[winnerIndex]);
  assert.equal(changed.hostRevision, 1);
  ok(await clients[0].call(requests[winnerIndex]));
  const winnerSeat = changed.players.find(player => player.id === changed.hostId).seat;
  const back = ok(await clients[winnerSeat - 1].call(body(changed, "transfer-host", {targetPlayerId: room.hostId})));
  assert.equal(back.hostId, room.hostId);
  assert.equal(back.hostRevision, 2);
  rejected(await clients[0].call(requests[winnerIndex]), 409);
  assert.equal((await clients[0].get(room.code)).hostId, room.hostId);
  console.log("PASS concurrent transfers: exactly one winner, duplicate receipt retry, and rejection of old authority after A-to-B-to-A");
}
