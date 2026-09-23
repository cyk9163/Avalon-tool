import test from "node:test";
import assert from "node:assert/strict";
import {canonicalAdminKey, configuredAdminKeys, verifyAdminKey} from "../lib/admin-key.ts";
import {collectAdminStats} from "../lib/admin-stats.ts";

// Public local fixture (see .dev.vars.example), never a production credential.
const localKey = "ADM-TEST-ADMN-KEYS-2345-6789";
const localHash = "80e08849f7ac5d9313b88cf1d785b3d250248c38e07efb0ecc6e4dd6e67c612c";

test("admin keys accept the canonical form with or without prefix and hyphens", async () => {
  for (const typed of [localKey, localKey.toLowerCase(), "TEST-ADMN-KEYS-2345-6789", "TESTADMNKEYS23456789", "ADMTESTADMNKEYS23456789", `  ${localKey}\n`]) {
    assert.equal(canonicalAdminKey(typed), localKey, typed);
    assert.equal(await verifyAdminKey(typed, localHash), true, typed);
  }
});

test("admin keys fail closed and never accept host keys or malformed input", async () => {
  for (const configuration of [undefined, null, "", "not-a-hash", 42, Array(17).fill(localHash).join(",")]) {
    assert.equal(await verifyAdminKey(localKey, configuration), null);
    assert.equal(configuredAdminKeys(configuration), 0);
  }
  assert.equal(configuredAdminKeys(`${localHash}, ${"b".repeat(64)}`), 2);
  for (const typed of [undefined, null, 7, {}, "", "AVL-TEST-KEYS-2345-6789", "TESTKEYS23456789", "ADM-TEST-ADMN-KEYS-2345-678", "ADM-TEST-ADMN-KEYS-2345-678O", "ADM-TEST ADMN KEYS 2345 6789", "X".repeat(200)]) {
    assert.equal(await verifyAdminKey(typed, localHash), false, String(typed));
  }
  assert.equal(await verifyAdminKey(localKey, "c".repeat(64)), false, "a different digest is refused");
});

test("admin statistics are shaped from aggregate rows only", async () => {
  const replies = [
    [{rooms: 3, players: 17, rounds: 5, recent: 1}],
    [{label: "lobby", count: 1}, {label: "finished", count: 2}],
    [{label: 7, count: 2}, {label: 10, count: 1}],
    [{label: "classic", count: 2}, {label: "custom", count: 1}],
    [{winner: "good", reason: "assassin-missed", count: 1}, {winner: "evil", reason: "three-failures", count: 1}],
    [{label: 0, count: 1}, {label: 5, count: 2}, {label: 30, count: 9}, {label: null, count: 4}],
    [{buckets: 12, networks: 1, recoveries: null}],
    [{started: 2, finished: 2, rematches: 1}],
  ];
  const statements = [];
  const db = {
    prepare(sql) { return {bind(...values) { statements.push({sql, values}); return {sql}; }}; },
    async batch(list) { assert.equal(list.length, replies.length); return replies.map(results => ({results})); },
  };
  const stats = await collectAdminStats(db, 1_790_000_000_000);
  assert.deepEqual(stats.rooms, {active: 3, players: 17, roundsPlayed: 5, createdLastHour: 1});
  assert.deepEqual(stats.phases, {lobby: 1, finished: 2});
  assert.deepEqual(stats.capacities, {7: 2, 10: 1});
  assert.equal(stats.hourly.length, 24);
  assert.equal(stats.hourly[0], 1);
  assert.equal(stats.hourly[5], 2);
  assert.equal(stats.hourly.reduce((a, b) => a + b, 0), 3, "out-of-range buckets are ignored");
  assert.deepEqual(stats.limits, {activeBuckets: 12, blockedNetworks: 1, blockedRecoveries: 0});
  assert.deepEqual(stats.flow, {started: 2, finished: 2, rematches: 1});
  assert.ok(statements.every(statement => statement.values.length === 1 && statement.values[0] === 1_790_000_000_000));
  for (const {sql} of statements) {
    assert.ok(!/SELECT\s+(code|state|owner_key|key)\b/i.test(sql), `aggregates only: ${sql}`);
    assert.ok(!/'\$\.players\[|\$\.game\.questVotes|questReceipts|\.name'|\.role'/.test(sql), "no personal or hidden fields are read");
  }
});
