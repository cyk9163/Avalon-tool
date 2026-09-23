import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "v0.8 integration checks only run against a local server.");

class Client {
  cookie = "";
  invite = "";
  ip = "";
  async init() {
    const response = await fetch(`${base}/api/room?session=1`);
    assert.equal(response.status, 200);
    this.cookie = response.headers.getSetCookie()[0].split(";")[0];
    return this;
  }
  // Locally the client IP header can be simulated; Cloudflare overwrites it in production.
  headers(extra = {}) { return {Cookie: this.cookie, ...(this.invite ? {"X-Avalon-Invite": this.invite} : {}), ...(this.ip ? {"CF-Connecting-IP": this.ip} : {}), ...extra}; }
  async call(body) {
    const response = await fetch(`${base}/api/room`, {method: "POST", headers: this.headers({"Content-Type": "application/json", Origin: base}), body: JSON.stringify(body)});
    return {status: response.status, data: await response.json(), requestId: response.headers.get("x-request-id")};
  }
  async get(code) {
    const response = await fetch(`${base}/api/room?code=${code}`, {headers: this.headers()});
    assert.equal(response.status, 200);
    return response.json();
  }
}
const ok = response => { assert.equal(response.status, 200, JSON.stringify(response)); return response.data; };

// v0.7: security headers, request IDs and the health probe.
{
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  assert.ok(csp?.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), `page CSP: ${csp}`);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("referrer-policy"), "same-origin");
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  const status = await health.json();
  assert.equal(status.status, "ok");
  assert.equal(status.checks.database, "ok");
  assert.match(status.version, /^\d+\.\d+\.\d+$/);
  const probe = await new Client().init();
  const missing = await probe.call({action: "ready", code: "000000", ready: true});
  assert.equal(missing.status, 404);
  assert.match(missing.requestId, /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(missing.data).includes(probe.cookie.split("=")[1]));
  console.log("PASS v0.7 baseline: security headers on pages/API, request IDs, health probe");
}

// v0.8: invite tokens, recovery codes and host-approved takeovers over the real API.
{
  const clients = await Promise.all(Array.from({length: 8}, () => new Client().init()));
  const [host, ...others] = clients;
  const created = ok(await host.call({action: "create", name: "恢复测试房主", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey}));
  const code = created.code;
  assert.match(created.inviteToken, /^[A-Za-z0-9_-]{22}$/);
  assert.match(created.recoveryCode, /^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  const stranger = others[6];
  const blind = await stranger.get(code);
  assert.equal(blind.namesHidden, true);
  assert.equal(blind.players[0].name, "");
  assert.equal(blind.inviteToken, null);
  stranger.invite = created.inviteToken;
  const invited = await stranger.get(code);
  assert.equal(invited.namesHidden, false);
  assert.equal(invited.players[0].name, "恢复测试房主");
  // Joining with only the six-digit code still works for face-to-face play.
  const joined = await Promise.all(others.slice(0, 4).map((client, index) => client.call({action: "join", code, name: `玩家${index + 2}`, seat: index + 2})));
  assert.ok(joined.every(response => response.status === 200));
  for (const client of clients.slice(0, 5)) ok(await client.call({action: "ready", code, ready: true, round: 1}));
  ok(await host.call({action: "start", code, round: 1}));
  const seat2 = await others[0].get(code), seat3 = await others[1].get(code);
  const lostIdentity = seat2.identity;
  // Recovery with a code: the new phone gets the identity, the old one loses it.
  const newPhone = others[4];
  assert.equal((await newPhone.call({action: "recover", code, seat: 2, recoveryCode: "22222-22222"})).status, 403);
  const recovered = ok(await newPhone.call({action: "recover", code, seat: 2, recoveryCode: seat2.recoveryCode}));
  assert.deepEqual(recovered.identity, lostIdentity);
  assert.notEqual(recovered.recoveryCode, seat2.recoveryCode);
  const oldPhone = await others[0].get(code);
  assert.equal(oldPhone.meId, null);
  assert.equal(oldPhone.identity, null);
  assert.deepEqual(oldPhone.recoveries.map(({seat, method}) => ({seat, method})), [{seat: 2, method: "code"}]);
  assert.equal((await others[5].call({action: "recover", code, seat: 2, recoveryCode: seat2.recoveryCode})).status, 403, "a used code is void");
  // Host-approved takeover for seat 3.
  const borrowed = others[5];
  assert.equal((await borrowed.call({action: "takeover-request", code, seat: 1})).status, 403, "the host seat needs a recovery code");
  const requested = ok(await borrowed.call({action: "takeover-request", code, seat: 3}));
  assert.equal(requested.myTakeover.seat, 3);
  assert.equal(requested.meId, null);
  const hostView = await host.get(code);
  assert.equal(hostView.takeoverRequests.length, 1);
  assert.equal((await others[2].call({action: "takeover-approve", code, requestId: hostView.takeoverRequests[0].id, hostRevision: 0})).status, 403);
  assert.equal(hostView.takeoverRequests[0].verifyCode, requested.myTakeover.verifyCode);
  assert.equal((await others[1].get(code)).takeoversOfMySeat.length, 1, "the seat owner is warned");
  const early = await host.call({action: "takeover-approve", code, requestId: hostView.takeoverRequests[0].id, hostRevision: hostView.hostRevision});
  assert.equal(early.status, 409, "approval waits for the objection window");
  // A rejected request from the owner's device cannot be approved.
  const intruder = await new Client().init();
  ok(await intruder.call({action: "takeover-request", code, seat: 4}));
  const intruderRequest = (await others[2].get(code)).takeoversOfMySeat[0];
  ok(await others[2].call({action: "takeover-reject", code, requestId: intruderRequest.id}));
  assert.equal((await host.get(code)).takeoverRequests.length, 1);
  console.log("… waiting for the 60 s takeover objection window");
  await new Promise(resolve => setTimeout(resolve, Math.max(0, hostView.takeoverRequests[0].approvableAt - Date.now()) + 1500));
  const approvals = await Promise.all([0, 1].map(() => host.call({action: "takeover-approve", code, requestId: hostView.takeoverRequests[0].id, hostRevision: hostView.hostRevision})));
  assert.ok(approvals.every(response => response.status === 200), "concurrent approval retries are idempotent");
  const taken = await borrowed.get(code);
  assert.deepEqual(taken.identity, seat3.identity);
  assert.equal((await others[1].get(code)).meId, null);
  assert.equal(taken.recoveries.at(-1).method, "host");
  // Unknown room codes are budgeted on POST as well as GET, per network.
  const sharedWifi = `198.51.100.${1 + Math.floor(Math.random() * 250)}`;
  const prober = await new Client().init();
  prober.ip = sharedWifi;
  const probes = [];
  for (let attempt = 0; attempt < 32; attempt++) probes.push((await prober.call({action: "takeover-cancel", code: String(100000 + attempt)})).status);
  assert.ok(probes.every(status => status === 404 || status === 429), JSON.stringify(probes));
  assert.ok(probes.slice(0, 30).every(status => status === 404) && probes.slice(30).every(status => status === 429), JSON.stringify(probes));
  {
    // Once the budget is spent, strangers on that network are refused even for
    // a real room, but seated players on the same network keep playing.
    const strangerAfter = await fetch(`${base}/api/room?code=${code}`, {headers: {Cookie: prober.cookie, "CF-Connecting-IP": sharedWifi}});
    assert.equal(strangerAfter.status, 429);
    host.ip = sharedWifi;
    assert.equal((await host.get(code)).meId, hostView.meId);
    ok(await host.call({action: "takeover-deny", code, requestId: "00000000-0000-4000-8000-000000000000", hostRevision: hostView.hostRevision}));
    host.ip = "";
  }
  console.log("PASS v0.8 recovery: invite-gated nicknames, one-time recovery codes, host-approved takeover, old devices revoked");
}

// v0.7: the scheduled cleanup handler is reachable in local development.
{
  const scheduled = await fetch(`${base}/cdn-cgi/handler/scheduled?cron=17+*+*+*+*`);
  if (scheduled.status === 404) console.log("SKIP scheduled handler: this local server does not expose /cdn-cgi/handler/scheduled");
  else {
    assert.equal(scheduled.status, 200);
    console.log("PASS scheduled cleanup handler runs");
  }
}
