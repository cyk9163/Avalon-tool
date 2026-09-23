// Build, deploy and smoke-test one environment.
//   node scripts/deploy.mjs            -> production
//   node scripts/deploy.mjs staging    -> staging (separate Worker and D1)
// The Cloudflare Vite plugin selects the wrangler environment from
// CLOUDFLARE_ENV at build time and writes a flattened dist/server/wrangler.json.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { projectRoot } from "./cloudflare-env.mjs";
import { ENVIRONMENTS } from "./environments.mjs";

const name = process.argv[2] || "production";
const target = ENVIRONMENTS[name];
if (!target) {
  console.error(`Unknown environment "${name}". Use one of: ${Object.keys(ENVIRONMENTS).join(", ")}`);
  process.exit(1);
}
// Only the build reads CLOUDFLARE_ENV. The deploy step must not see it: the
// built config is already flattened, and wrangler would append the
// environment name to the Worker name a second time.
const buildEnv = { ...process.env }, deployEnv = { ...process.env };
delete buildEnv.CLOUDFLARE_ENV; delete deployEnv.CLOUDFLARE_ENV;
if (target.wranglerEnv) buildEnv.CLOUDFLARE_ENV = target.wranglerEnv;

for (const [args, env] of [
  [["scripts/run-framework.mjs", "build"], buildEnv],
  [["scripts/wrangler.mjs", "deploy", "--config", "dist/server/wrangler.json"], deployEnv],
  // Post-deploy smoke test against the deployed URL (read-only).
  [["scripts/smoke.mjs", target.url], deployEnv],
]) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (args[1] === "build") {
    // Never let a build for one environment deploy over another.
    const built = JSON.parse(readFileSync(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
    if (built.name !== target.worker) {
      console.error(`Refusing to deploy: build targets Worker "${built.name}", expected "${target.worker}".`);
      process.exit(1);
    }
  }
}
