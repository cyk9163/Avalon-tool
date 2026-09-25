import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {applySecurityHeaders, contentSecurityPolicy, securityHeaders, PERMISSIONS_POLICY} from "../lib/security-headers.ts";
import {cleanupExpired, runScheduledMaintenance} from "../lib/maintenance.ts";
import {roomRef} from "../lib/log.ts";
import {APP_VERSION} from "../lib/version.ts";

test("pages and API responses carry the security baseline without losing their own headers", async () => {
  const original = new Response("{}", {status: 201, headers: {"Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});
  const wrapped = applySecurityHeaders(new Request("https://avalon.example/api/room"), original);
  assert.equal(wrapped.status, 201);
  assert.equal(wrapped.headers.get("cache-control"), "no-store");
  assert.equal(await wrapped.text(), "{}");
  const csp = wrapped.headers.get("content-security-policy");
  for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "connect-src 'self'", "upgrade-insecure-requests"]) {
    assert.ok(csp.includes(directive), directive);
  }
  assert.ok(!csp.includes("unsafe-eval"), "production never allows eval");
  assert.equal(wrapped.headers.get("x-frame-options"), "DENY");
  assert.equal(wrapped.headers.get("referrer-policy"), "same-origin");
  assert.match(wrapped.headers.get("strict-transport-security"), /max-age=31536000/);
  assert.equal(wrapped.headers.get("permissions-policy"), PERMISSIONS_POLICY);
  const local = applySecurityHeaders(new Request("http://localhost:5173/"), new Response("ok"), true);
  assert.equal(local.headers.get("strict-transport-security"), null, "HSTS only over HTTPS");
  assert.match(local.headers.get("content-security-policy"), /unsafe-eval/);
  assert.match(local.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.equal(local.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.ok(!local.headers.get("content-security-policy").includes("upgrade-insecure-requests"));
  const staging = applySecurityHeaders(new Request("https://avalon-roundtable-staging.yunkangchen2017.workers.dev/"), new Response("ok"));
  assert.match(staging.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.equal(staging.headers.get("x-frame-options"), "SAMEORIGIN");
  const production = applySecurityHeaders(new Request("https://avalon-roundtable.yunkangchen2017.workers.dev/"), new Response("ok"));
  assert.match(production.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(production.headers.get("x-frame-options"), "DENY");
});

test("static assets use the same policy as Worker responses", () => {
  const rules = readFileSync(new URL("../public/_headers", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(rules.includes(`Content-Security-Policy: ${contentSecurityPolicy()}`));
  for (const [name, value] of Object.entries(securityHeaders({secure: true}))) {
    if (name === "Content-Security-Policy") continue;
    assert.ok(rules.includes(`${name}: ${value}`), name);
  }
  assert.match(rules, /\/_next\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});

test("scheduled cleanup deletes expired rows in bounded batches and logs counts", async () => {
  const calls = [];
  const remaining = {rooms: 1203, rate_limits: 7, push_subscriptions: 4};
  const db = {prepare(sql) {
    return {bind(now, limit) {
      return {async run() {
        const table = sql.includes("push_subscriptions") ? "push_subscriptions" : sql.includes("FROM rooms") ? "rooms" : "rate_limits";
        calls.push({table, now, limit});
        const changes = Math.min(limit, remaining[table]);
        remaining[table] -= changes;
        return {meta: {changes}};
      }};
    }};
  }};
  assert.deepEqual(await cleanupExpired(db, 1234, 500, 20), {rooms: 1203, rateLimits: 7, pushSubscriptions: 4});
  assert.deepEqual(calls.map(call => call.table), ["rooms", "rooms", "rooms", "rate_limits", "push_subscriptions"]);
  assert.ok(calls.every(call => call.now === 1234 && call.limit === 500));
  const lines = [];
  const original = console.log;
  console.log = line => lines.push(JSON.parse(line));
  try { await runScheduledMaintenance(db, "17 * * * *"); } finally { console.log = original; }
  assert.equal(lines[0].event, "maintenance.cleanup");
  assert.equal(lines[0].cron, "17 * * * *");
  assert.equal(typeof lines[0].deletedRooms, "number");
});

test("logs refer to rooms pseudonymously and the version constant matches package.json", async () => {
  const ref = await roomRef("123456");
  assert.match(ref, /^[a-f0-9]{12}$/);
  assert.ok(!ref.includes("123456"));
  assert.equal(await roomRef("../etc"), null);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(APP_VERSION, pkg.version);
});
