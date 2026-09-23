import { log } from "./log.ts";

type Db = Pick<D1Database, "prepare">;

// Deletes in bounded batches so a single cron run stays well inside the
// free-plan CPU limit even after a long quiet period.
async function deleteExpired(db: Db, table: "rooms" | "rate_limits" | "push_subscriptions", now: number, batchSize: number, maxBatches: number) {
  const column = table === "rooms" ? "code" : table === "rate_limits" ? "key" : "id";
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const result = await db.prepare(
      `DELETE FROM ${table} WHERE ${column} IN (SELECT ${column} FROM ${table} WHERE expires_at < ? LIMIT ?)`,
    ).bind(now, batchSize).run();
    const changes = result.meta?.changes ?? 0;
    deleted += changes;
    if (changes < batchSize) break;
  }
  return deleted;
}

export async function cleanupExpired(db: Db, now = Date.now(), batchSize = 500, maxBatches = 20) {
  const rooms = await deleteExpired(db, "rooms", now, batchSize, maxBatches);
  const rateLimits = await deleteExpired(db, "rate_limits", now, batchSize, maxBatches);
  const pushSubscriptions = await deleteExpired(db, "push_subscriptions", now, batchSize, maxBatches);
  return { rooms, rateLimits, pushSubscriptions };
}

export async function runScheduledMaintenance(db: Db | undefined, cron: string) {
  const started = Date.now();
  if (!db) {
    log("error", "maintenance.failed", { cron, reason: "missing-db-binding" });
    return;
  }
  try {
    const result = await cleanupExpired(db, started);
    log("info", "maintenance.cleanup", { cron, deletedRooms: result.rooms, deletedRateLimits: result.rateLimits, deletedPushSubscriptions: result.pushSubscriptions, durationMs: Date.now() - started });
  } catch (error) {
    log("error", "maintenance.failed", { cron, reason: error instanceof Error ? error.message : "unknown", durationMs: Date.now() - started });
    throw error;
  }
}
