// End-to-end check of the live channel on the deployed staging Worker:
// creates a throwaway room (expires in 24 h), opens a WebSocket, has a second
// device join, and expects the version signal. Writes data, so it refuses to
// run against anything but staging.
//   npm run check:staging
// The host key comes from AVALON_STAGING_HOST_KEY or the first key in
// work/staging-host-keys.txt (git-ignored); it is never printed.
import { readFileSync } from "node:fs";
import { ENVIRONMENTS } from "./environments.mjs";

const base = ENVIRONMENTS.staging.url;
if (process.env.AVALON_SMOKE_URL && new URL(process.env.AVALON_SMOKE_URL).origin !== base) throw new Error("staging-check only runs against staging.");
function stagingKey() {
  if (process.env.AVALON_STAGING_HOST_KEY) return process.env.AVALON_STAGING_HOST_KEY;
  try {
    return readFileSync(new URL("../work/staging-host-keys.txt", import.meta.url), "utf8").match(/AVL-(?:[2-9A-HJ-NP-Z]{4}-){3}[2-9A-HJ-NP-Z]{4}/)?.[0];
  } catch {
    return undefined;
  }
}
const hostKey = stagingKey();
if (!hostKey) throw new Error("No staging host key: set AVALON_STAGING_HOST_KEY or create work/staging-host-keys.txt.");

function fail(message) {
  console.error(`STAGING CHECK FAIL ${base}: ${message}`);
  process.exit(1);
}
async function device() {
  const response = await fetch(`${base}/api/room?session=1`);
  if (!response.ok) fail(`session bootstrap returned ${response.status}`);
  const cookie = response.headers.getSetCookie()[0].split(";")[0];
  return {
    cookie,
    async call(body) {
      const reply = await fetch(`${base}/api/room`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, Cookie: cookie }, body: JSON.stringify(body) });
      return { status: reply.status, data: await reply.json() };
    },
  };
}

const [host, guest] = [await device(), await device()];
const created = await host.call({ action: "create", name: "预发布检查", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey });
if (created.status !== 200) fail(`create returned ${created.status}: ${created.data.error ?? ""}`);
const code = created.data.code;

const messages = [];
const socket = new WebSocket(`${base.replace(/^https/, "wss")}/api/room/live?code=${code}`, { headers: { Origin: base, Cookie: host.cookie } });
socket.onmessage = event => messages.push(event.data);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = () => reject(new Error("handshake refused"));
  setTimeout(() => reject(new Error("handshake timed out")), 10_000);
}).catch(error => fail(error.message));
const waitFor = async (predicate, label) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const hit = messages.find(predicate);
    if (hit) return hit;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  fail(`no ${label} within 10 s (got ${JSON.stringify(messages)})`);
};

socket.send("ping");
await waitFor(message => message === "pong", "pong");
const started = Date.now();
const joined = await guest.call({ action: "join", code, name: "预发布玩家", seat: 2 });
if (joined.status !== 200) fail(`join returned ${joined.status}`);
const signal = await waitFor(message => message.startsWith("{"), "live signal");
const latency = Date.now() - started;
if (signal !== JSON.stringify({ type: "changed", version: joined.data.version })) fail(`unexpected signal ${signal}`);
socket.close(1000);

const refused = await new Promise(resolve => {
  const probe = new WebSocket(`${base.replace(/^https/, "wss")}/api/room/live?code=${code}`, { headers: { Origin: "https://not-this-site.example" } });
  probe.onopen = () => { probe.close(); resolve(false); };
  probe.onerror = () => resolve(true);
});
if (!refused) fail("cross-site handshake was accepted");
console.log(`STAGING CHECK OK ${base}: live signal ${latency} ms after the join (including the join request), pong answered, cross-site handshake refused`);
