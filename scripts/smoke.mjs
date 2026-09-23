// Post-deploy smoke test: node scripts/smoke.mjs [url]
// Waits until the given site reports the version in package.json through
// /api/health, then checks the security headers on the home page. Read-only:
// it never creates rooms or writes to the production database.
// AVALON_SMOKE_ANY_VERSION=1 accepts whatever version is live (the hourly
// uptime monitor, which may run between a push and its deploy).
import { readFileSync } from "node:fs";
import { ENVIRONMENTS } from "./environments.mjs";

const target = new URL(process.argv[2] || process.env.AVALON_SMOKE_URL || ENVIRONMENTS.production.url).origin;
const expected = process.env.AVALON_SMOKE_ANY_VERSION ? null : JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
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
    if (response.ok && health.status === "ok" && (expected === null || health.version === expected)) break;
  } catch {
    // Keep waiting: a fresh deployment can take a few seconds to propagate.
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
if (!health) fail("health endpoint unreachable");
if (expected !== null && health.version !== expected) fail(`expected version ${expected}, got ${health.version ?? "unknown"}`);
if (health.status !== "ok") fail(`health status ${health.status}`);

const page = await fetch(`${target}/`, { cache: "no-store" });
if (!page.ok) fail(`home page returned ${page.status}`);
const csp = page.headers.get("content-security-policy") ?? "";
for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "default-src 'self'"]) {
  if (!csp.includes(directive)) fail(`home page CSP is missing ${directive}`);
}
if (target.startsWith("https:") && !page.headers.get("strict-transport-security")) fail("HSTS header missing");
// The live endpoint must be answered by the Worker gateway (not the app's 404
// page). A plain GET is refused before any room lookup, so this reads nothing.
for (const path of ["/rules", "/privacy", "/me"]) {
  const doc = await fetch(`${target}${path}`, { cache: "no-store" });
  if (!doc.ok) fail(`${path} returned ${doc.status}`);
  if (!(doc.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'")) fail(`${path} is missing the CSP`);
}
// The admin API must refuse a request without a key (and never serve stats).
const adminProbe = await fetch(`${target}/api/admin`, { cache: "no-store" });
if (adminProbe.status !== 401) fail(`admin API without a key returned ${adminProbe.status}, expected 401`);
const live = await fetch(`${target}/api/room/live?code=000000`, { cache: "no-store" });
if (live.status !== 426) fail(`live endpoint returned ${live.status}, expected 426`);
console.log(`SMOKE OK ${target}: version ${health.version}, database ${health.checks?.database}, security headers present, rules/privacy/record pages up, admin API locked, live gateway answering`);
