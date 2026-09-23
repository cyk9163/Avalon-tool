import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LIVE_PATH, LIVE_FALLBACK_POLL_MS, MAX_LIVE_SOCKETS, isWebSocketUpgrade, liveOriginAllowed, liveSignal, parseLiveSignal} from "../lib/live.ts";

test("live signals carry only a positive room version", () => {
  assert.equal(liveSignal(7), '{"type":"changed","version":7}');
  assert.equal(parseLiveSignal(liveSignal(42)), 42);
  for (const bad of [undefined, 3, "", "pong", "{", '{"type":"changed"}', '{"type":"changed","version":0}', '{"type":"changed","version":1.5}', '{"type":"other","version":3}', `{"type":"changed","version":1,"pad":"${"x".repeat(80)}"}`]) {
    assert.equal(parseLiveSignal(bad), null, String(bad));
  }
});

test("live handshakes must be same-origin WebSocket upgrades", () => {
  const url = `https://avalon.example${LIVE_PATH}?code=123456`;
  assert.ok(liveOriginAllowed(new Request(url, {headers: {Origin: "https://avalon.example"}})));
  assert.ok(!liveOriginAllowed(new Request(url)), "missing Origin is refused");
  assert.ok(!liveOriginAllowed(new Request(url, {headers: {Origin: "https://evil.example"}})));
  assert.ok(!liveOriginAllowed(new Request(url, {headers: {Origin: "http://avalon.example"}})), "scheme must match");
  assert.ok(isWebSocketUpgrade(new Request(url, {headers: {Upgrade: "WebSocket"}})));
  assert.ok(!isWebSocketUpgrade(new Request(url)));
});

test("live channel limits stay within the free plan and keep a polling safety net", () => {
  assert.ok(MAX_LIVE_SOCKETS >= 30 && MAX_LIVE_SOCKETS <= 64);
  assert.ok(LIVE_FALLBACK_POLL_MS >= 15000 && LIVE_FALLBACK_POLL_MS <= 60000);
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  // The free plan only supports SQLite-backed Durable Objects.
  assert.equal((config.match(/"new_sqlite_classes": \["RoomHub"\]/g) ?? []).length, 2, "production and staging both declare the SQLite class");
  assert.ok(!/"new_classes"/.test(config), "no key-value Durable Objects (paid plan only)");
  assert.match(config, /"name": "avalon-roundtable-staging"/);
  assert.match(config, /"database_name": "avalon-roundtable-staging-db"/);
});
