// Post-deploy smoke test: node scripts/smoke.mjs [url]
// Waits until the given site reports the version in package.json through
// /api/health, then checks the security headers on the home page. Read-only:
// it never creates rooms or writes to the production database.
import { readFileSync } from "node:fs";

const PRODUCTION_URL = "https://avalon-roundtable.yunkangchen2017.workers.dev";
const target = new URL(process.argv[2] || process.env.AVALON_SMOKE_URL || PRODUCTION_URL).origin;
const expected = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const deadline = Date.now() + 90_000;

function fail(message) {
  console.error(`SMOKE FAIL ${target}: ${message}`);
  console.error("Roll back with: npm run cf:deployments, then npm run cf:rollback -- <version-id>");
  process.exit(1);
}

let health;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${target}/api/health`, { cache: "no-store" });
    health = await response.json();
    if (response.ok && health.status === "ok" && health.version === expected) break;
  } catch {
    // Keep waiting: a fresh deployment can take a few seconds to propagate.
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
if (!health) fail("health endpoint unreachable");
if (health.version !== expected) fail(`expected version ${expected}, got ${health.version ?? "unknown"}`);
if (health.status !== "ok") fail(`health status ${health.status}`);

const page = await fetch(`${target}/`, { cache: "no-store" });
if (!page.ok) fail(`home page returned ${page.status}`);
const csp = page.headers.get("content-security-policy") ?? "";
for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "default-src 'self'"]) {
  if (!csp.includes(directive)) fail(`home page CSP is missing ${directive}`);
}
if (target.startsWith("https:") && !page.headers.get("strict-transport-security")) fail("HSTS header missing");
console.log(`SMOKE OK ${target}: version ${health.version}, database ${health.checks?.database}, security headers present`);
