// Aggregate, anonymous statistics for the operator dashboard (v0.12). Every
// query returns counts only: no room codes, nicknames, device keys, roles,
// votes or quest cards ever leave the database through this module.
type Db = Pick<D1Database, "prepare" | "batch">;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type AdminStats = {
  generatedAt: string;
  rooms: { active: number; players: number; roundsPlayed: number; createdLastHour: number };
  phases: Record<string, number>;
  capacities: Record<string, number>;
  presets: Record<string, number>;
  results: { winner: string; reason: string; count: number }[];
  hourly: number[]; // rooms created per hour, index 0 = the last hour, 23 = a day ago
  limits: { activeBuckets: number; blockedNetworks: number; blockedRecoveries: number };
};

type CountRow = { label: string | number | null; count: number };

function toRecord(rows: CountRow[]): Record<string, number> {
  const record: Record<string, number> = {};
  for (const row of rows) record[String(row.label ?? "unknown")] = row.count;
  return record;
}

export async function collectAdminStats(db: Db, now = Date.now()): Promise<AdminStats> {
  const active = "expires_at > ?1";
  const [totals, phases, capacities, presets, results, hourly, limits] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS rooms, COALESCE(SUM(json_array_length(state, '$.players')), 0) AS players, COALESCE(SUM(COALESCE(json_extract(state, '$.round'), 1)), 0) AS rounds, SUM(CASE WHEN expires_at - ${DAY_MS} > ?1 - ${HOUR_MS} THEN 1 ELSE 0 END) AS recent FROM rooms WHERE ${active}`).bind(now),
    db.prepare(`SELECT json_extract(state, '$.phase') AS label, COUNT(*) AS count FROM rooms WHERE ${active} GROUP BY label`).bind(now),
    db.prepare(`SELECT json_extract(state, '$.capacity') AS label, COUNT(*) AS count FROM rooms WHERE ${active} GROUP BY label`).bind(now),
    db.prepare(`SELECT json_extract(state, '$.preset') AS label, COUNT(*) AS count FROM rooms WHERE ${active} GROUP BY label`).bind(now),
    db.prepare(`SELECT json_extract(state, '$.game.result.winner') AS winner, json_extract(state, '$.game.result.reason') AS reason, COUNT(*) AS count FROM rooms WHERE ${active} AND json_extract(state, '$.phase') = 'finished' GROUP BY winner, reason`).bind(now),
    db.prepare(`SELECT CAST((?1 - (expires_at - ${DAY_MS})) / ${HOUR_MS} AS INTEGER) AS label, COUNT(*) AS count FROM rooms WHERE ${active} GROUP BY label`).bind(now),
    db.prepare(`SELECT COUNT(*) AS buckets, SUM(CASE WHEN key LIKE 'miss:%' AND count >= 30 THEN 1 ELSE 0 END) AS networks, SUM(CASE WHEN key LIKE 'recover%' AND count >= 8 THEN 1 ELSE 0 END) AS recoveries FROM rate_limits WHERE expires_at > ?1`).bind(now),
  ]);
  const total = (totals.results[0] ?? {}) as { rooms?: number; players?: number; rounds?: number; recent?: number };
  const buckets = Array<number>(24).fill(0);
  for (const row of hourly.results as CountRow[]) {
    if (row.label === null || row.label === "") continue;
    const index = Number(row.label);
    if (Number.isInteger(index) && index >= 0 && index < 24) buckets[index] += row.count;
  }
  const limit = (limits.results[0] ?? {}) as { buckets?: number; networks?: number; recoveries?: number };
  return {
    generatedAt: new Date(now).toISOString(),
    rooms: { active: total.rooms ?? 0, players: total.players ?? 0, roundsPlayed: total.rounds ?? 0, createdLastHour: total.recent ?? 0 },
    phases: toRecord(phases.results as CountRow[]),
    capacities: toRecord(capacities.results as CountRow[]),
    presets: toRecord(presets.results as CountRow[]),
    results: (results.results as { winner: string | null; reason: string | null; count: number }[])
      .map(row => ({ winner: row.winner ?? "unknown", reason: row.reason ?? "unknown", count: row.count })),
    hourly: buckets,
    limits: { activeBuckets: limit.buckets ?? 0, blockedNetworks: limit.networks ?? 0, blockedRecoveries: limit.recoveries ?? 0 },
  };
}
