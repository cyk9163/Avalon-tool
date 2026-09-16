import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const origin = "https://avalon.example";
const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function workerHarness() {
  const handlers = new Map();
  const cacheEntries = new Map();
  const cacheWrites = [];
  const deletedCaches = [];
  const networkRequests = [];
  const fallbackReads = [];
  const offlineNotice = "<html><p>请恢复网络后重试。</p></html>";
  let cacheNames = [];
  let network = async () => new Response("live page");

  class WorkerRequest extends Request {
    constructor(url, options) { super(new URL(url, origin), options); }
  }

  const caches = {
    async open(name) {
      if (!cacheNames.includes(name)) cacheNames.push(name);
      return {
        async add(request) {
          cacheWrites.push({ name, request });
          cacheEntries.set(request.url, new Response(offlineNotice, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
        },
        async match(url) {
          fallbackReads.push(url);
          const entry = cacheEntries.get(new URL(url, origin).href);
          if (!entry) return undefined;
          const response = entry.clone();
          // Cache.match preserves response redirect metadata in real browsers.
          if (entry.redirected) Object.defineProperty(response, "redirected", { value: true });
          if (entry.url) Object.defineProperty(response, "url", { value: entry.url });
          return response;
        },
      };
    },
    async keys() { return cacheNames; },
    async delete(name) { deletedCaches.push(name); return true; },
  };

  vm.runInNewContext(source, {
    self: { location: { origin }, addEventListener: (type, handler) => handlers.set(type, handler) },
    Request: WorkerRequest, Response, URL, caches,
    fetch: async (request, options) => {
      networkRequests.push({ request, options });
      return network(request, options);
    },
  });

  return {
    cacheEntries, cacheWrites, deletedCaches, networkRequests, fallbackReads, offlineNotice,
    setNetwork(next) { network = next; },
    setCaches(names) { cacheNames = names; },
    async lifecycle(type) {
      let promise;
      handlers.get(type)({ waitUntil: value => { promise = value; } });
      await promise;
    },
    request(path, { mode = "navigate", method = "GET" } = {}) {
      let response;
      const request = { url: new URL(path, origin).href, mode, method, redirect: mode === "navigate" ? "manual" : "follow" };
      handlers.get("fetch")({ request, respondWith: value => { response = value; } });
      return response;
    },
  };
}

test("PWA install caches only the public offline notice and online pages remain uncached", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  assert.equal(worker.cacheWrites.length, 1);
  const { request } = worker.cacheWrites[0];
  assert.equal(request.url, `${origin}/offline.html`);
  assert.equal(request.credentials, "omit");
  assert.equal(request.cache, "reload");

  worker.setNetwork(async () => new Response("private identity page", { headers: { "Cache-Control": "private, no-store" } }));
  const response = await worker.request("/?room=123456");
  assert.equal(await response.text(), "private identity page");
  assert.equal(worker.networkRequests[0].options.cache, "no-store");
  assert.equal(worker.cacheWrites.length, 1);
  assert.deepEqual([...worker.cacheEntries.keys()], [`${origin}/offline.html`]);
  assert.equal(worker.fallbackReads.length, 0);
});

test("PWA leaves API, votes, RSC and asset requests outside its fetch handler", () => {
  const worker = workerHarness();
  for (const [path, options] of [
    ["/api/room?code=123456", { mode: "same-origin" }],
    ["/api/room?session=1", { mode: "navigate" }],
    ["/api", { mode: "navigate" }],
    ["/api/room", { mode: "same-origin", method: "POST" }],
    ["/", { mode: "navigate", method: "POST" }],
    ["/?_rsc=private", { mode: "cors" }],
    ["/assets/app.js", { mode: "no-cors" }],
    ["https://another.example/", { mode: "navigate" }],
  ]) {
    assert.equal(worker.request(path, options), undefined, `should not intercept ${path} ${JSON.stringify(options)}`);
  }
  assert.equal(worker.networkRequests.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("PWA navigation network failure shows the public offline page without private state", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  worker.setNetwork(async () => { throw new TypeError("Failed to fetch"); });
  const response = await worker.request("/?room=123456");
  assert.equal(await response.text(), worker.offlineNotice);
  assert.match(response.headers.get("Content-Type"), /^text\/html/);
  assert.equal(worker.cacheWrites.length, 1);
  assert.deepEqual(worker.fallbackReads, ["/offline.html"]);
});

test("PWA preserves live HTTP errors instead of replacing them with an offline page", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  worker.setNetwork(async () => new Response("temporary maintenance", { status: 503 }));
  const response = await worker.request("/");
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "temporary maintenance");
  assert.equal(worker.fallbackReads.length, 0);
  assert.equal(worker.cacheWrites.length, 1);
});

test("PWA can serve a cached offline asset that originally followed a host redirect", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  const cached = new Response(worker.offlineNotice, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Encoding": "gzip",
    "Content-Length": "1",
    "Set-Cookie": "must-not-replay=1",
  } });
  Object.defineProperty(cached, "redirected", { value: true });
  Object.defineProperty(cached, "url", { value: `${origin}/offline` });
  worker.cacheEntries.set(`${origin}/offline.html`, cached);
  worker.setNetwork(async () => { throw new TypeError("Failed to fetch"); });

  const response = await worker.request("/?room=123456");
  assert.equal(worker.networkRequests[0].request.redirect, "manual");
  assert.equal(response.redirected, false, "manual navigation must not receive a followed-redirect response");
  assert.equal(response.url, "");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), worker.offlineNotice);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  for (const header of ["Content-Encoding", "Content-Length", "Set-Cookie"]) assert.equal(response.headers.get(header), null);
  assert.equal(worker.cacheWrites.length, 1);
});

test("PWA remains safe if the browser has evicted its cached offline notice", async () => {
  const worker = workerHarness();
  worker.setNetwork(async () => { throw new TypeError("Failed to fetch"); });
  const response = await worker.request("/?room=123456");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("Content-Type"), /^text\/plain/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /123456/);
  assert.equal(worker.cacheWrites.length, 0);
});

test("PWA activation only removes obsolete caches owned by this offline feature", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  const activeName = worker.cacheWrites[0].name;
  worker.setCaches([activeName, "avalon-offline-old", "unrelated-feature"]);
  await worker.lifecycle("activate");
  assert.deepEqual(worker.deletedCaches, ["avalon-offline-old"]);
});

test("PWA manifest has a public standalone entry and correctly sized install icons", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  const anyIcons = manifest.icons.filter(icon => icon.purpose === "any");
  assert.ok(anyIcons.some(icon => icon.sizes === "192x192"));
  assert.ok(anyIcons.some(icon => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable"));
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
