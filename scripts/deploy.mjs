import { spawnSync } from "node:child_process";
import { projectRoot } from "./cloudflare-env.mjs";

for (const args of [
  ["scripts/run-framework.mjs", "build"],
  ["scripts/wrangler.mjs", "deploy", "--config", "dist/server/wrangler.json"],
  // Post-deploy smoke test against the production URL (read-only).
  ["scripts/smoke.mjs"],
]) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
