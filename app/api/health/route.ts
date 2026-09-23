import { env } from "cloudflare:workers";
import { log } from "@/lib/log";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// Public liveness/readiness probe for uptime monitors and post-deploy smoke
// tests. It reports only coarse status: no counts, identifiers or errors.
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    if (!env.DB) throw new Error("missing-db-binding");
    await env.DB.prepare("SELECT 1 AS ok").first();
  } catch (error) {
    database = "error";
    log("error", "health.database", { reason: error instanceof Error ? error.message : "unknown" });
  }
  const healthy = database === "ok";
  return new Response(JSON.stringify({
    status: healthy ? "ok" : "degraded",
    version: APP_VERSION,
    checks: { database },
    time: new Date(started).toISOString(),
    latencyMs: Date.now() - started,
  }), {
    status: healthy ? 200 : 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
