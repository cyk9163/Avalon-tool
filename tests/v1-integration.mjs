import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "v1.0 integration checks only run against a local server.");

class Client {
  cookie = "";
  async init() { const r = await fetch(`${base}/api/room?session=1`); this.cookie = r.headers.getSetCookie()[0].split(";")[0]; return this; }
  async call(body) { const r = await fetch(`${base}/api/room`, {method: "POST", headers: {"Content-Type": "application/json", Origin: base, Cookie: this.cookie}, body: JSON.stringify(body)}); return {status: r.status, data: await r.json()}; }
  async get(code) { return (await fetch(`${base}/api/room?code=${code}`, {headers: {Cookie: this.cookie}})).json(); }
}
const ok = response => { assert.equal(response.status, 200, JSON.stringify(response)); return response.data; };

{
  const clients = await Promise.all(Array.from({length: 5}, () => new Client().init()));
  const bad = await clients[0].call({action: "create", name: "规则测试", capacity: 5, preset: "classic", anytimeAssassin: "yes", requestId: crypto.randomUUID(), hostKey});
  assert.equal(bad.status, 400, "the option must be a boolean");
  const {code, anytimeAssassin} = ok(await clients[0].call({action: "create", name: "规则测试", capacity: 5, preset: "classic", anytimeAssassin: true, requestId: crypto.randomUUID(), hostKey}));
  assert.equal(anytimeAssassin, true);
  for (let i = 1; i < 5; i++) ok(await clients[i].call({action: "join", code, name: `玩家${i + 1}`, seat: i + 1}));
  for (const client of clients) ok(await client.call({action: "ready", code, ready: true}));
  ok(await clients[0].call({action: "start", code}));
  const views = await Promise.all(clients.map(client => client.get(code)));
  for (const client of clients) ok(await client.call({action: "confirm", code}));
  const started = ok(await clients[0].call({action: "begin", code}));
  assert.equal(started.phase, "team");
  assert.ok(views.every(view => view.anytimeAssassin === true), "every player sees the house rule");
  const assassin = views.findIndex(view => view.identity.role === "assassin");
  const merlinSeat = views.findIndex(view => view.identity.role === "merlin") + 1;
  const other = views.findIndex(view => !["assassin", "merlin"].includes(view.identity.role));
  assert.equal((await clients[other].call({action: "assassinate", code, turnId: started.game.turnId, targetSeat: merlinSeat})).status, 403, "only the assassin may strike");
  const finished = ok(await clients[assassin].call({action: "assassinate", code, turnId: started.game.turnId, targetSeat: merlinSeat}));
  assert.equal(finished.phase, "finished");
  assert.deepEqual(finished.game.result, {winner: "evil", reason: "merlin-assassinated", targetSeat: merlinSeat, early: true});
  assert.equal((await clients[0].get(code)).game.revealedRoles.length, 5);
  console.log("PASS v1.0 anytime assassin: boolean option, visible rule, assassin-only early strike ends the game");
}
