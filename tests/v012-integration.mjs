import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
const adminKey = process.env.AVALON_TEST_ADMIN_KEY || "ADM-TEST-ADMN-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "v0.12 integration checks only run against a local server.");

async function admin(key, headers = {}) {
  const response = await fetch(`${base}/api/admin`, {headers: {...(key ? {"X-Admin-Key": key} : {}), ...headers}});
  return {status: response.status, headers: response.headers, text: await response.text()};
}

{
  // A room with a recognizable nickname, to prove the dashboard never echoes it.
  const session = await fetch(`${base}/api/room?session=1`);
  const cookie = session.headers.getSetCookie()[0].split(";")[0];
  const created = await fetch(`${base}/api/room`, {method: "POST", headers: {"Content-Type": "application/json", Origin: base, Cookie: cookie}, body: JSON.stringify({action: "create", name: "统计暗号甲", capacity: 8, preset: "classic", requestId: crypto.randomUUID(), hostKey})});
  assert.equal(created.status, 200);
  const {code} = await created.json();

  assert.equal((await admin(null)).status, 401);
  assert.equal((await admin("ADM-WRNG-WRNG-WRNG-WRNG-WRNG")).status, 403);
  assert.equal((await admin(hostKey)).status, 403, "a host key never opens the dashboard");
  assert.equal((await admin(adminKey, {Origin: "https://not-this-site.example"})).status, 403);
  assert.equal((await admin(adminKey, {"Sec-Fetch-Site": "cross-site"})).status, 403);

  const ok = await admin(adminKey.replaceAll("-", "").toLowerCase());
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.headers.get("cache-control"), "no-store, private");
  assert.equal(ok.headers.get("x-robots-tag"), "noindex");
  const stats = JSON.parse(ok.text);
  assert.ok(stats.rooms.active >= 1 && stats.rooms.players >= 1);
  assert.ok(stats.phases.lobby >= 1);
  assert.ok(stats.capacities["8"] >= 1);
  assert.ok(stats.presets.classic >= 1);
  assert.equal(stats.hourly.length, 24);
  assert.ok(stats.hourly[0] >= 1, "the room created just now is in the current hour");
  assert.equal(stats.service.liveHub, true);
  assert.ok(stats.service.hostKeys >= 1 && stats.service.adminKeys >= 1);
  assert.ok(!ok.text.includes(code), "no room codes");
  assert.ok(!ok.text.includes("统计暗号甲"), "no nicknames");
  // ("identity" is also a phase name, so it is checked as a field shape instead.)
  assert.ok(!/"(key|owner|owner_key|role|name|known|recovery|state)":/.test(ok.text), "no personal fields");
  assert.ok(!/"identity":s*[{[]/.test(ok.text), "no identity objects");

  // Wrong keys are limited per network (simulated locally with CF-Connecting-IP).
  const ip = {"CF-Connecting-IP": `198.51.100.${Math.floor(Math.random() * 200) + 20}`};
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await admin("ADM-WRNG-WRNG-WRNG-WRNG-WRNG", ip)).status, 403);
  assert.equal((await admin("ADM-WRNG-WRNG-WRNG-WRNG-WRNG", ip)).status, 429);
  assert.equal((await admin(adminKey, ip)).status, 429, "the locked network waits out the window");
  assert.equal((await admin(adminKey)).status, 200, "other networks are unaffected");
  console.log("PASS v0.12 admin: key required, host keys refused, same-origin only, aggregate stats without codes or names, failure rate limit");
}
