import assert from "node:assert/strict";

const base = new URL(process.env.AVALON_TEST_URL || "http://localhost:5173").origin;
const hostKey = process.env.AVALON_TEST_HOST_KEY || "AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "v0.9 integration checks only run against a local server.");
const wsBase = base.replace(/^http/, "ws");

class Client {
  cookie = "";
  async init() {
    const response = await fetch(`${base}/api/room?session=1`);
    assert.equal(response.status, 200);
    this.cookie = response.headers.getSetCookie()[0].split(";")[0];
    return this;
  }
  async call(body) {
    const response = await fetch(`${base}/api/room`, {method: "POST", headers: {"Content-Type": "application/json", Origin: base, Cookie: this.cookie}, body: JSON.stringify(body)});
    return {status: response.status, data: await response.json()};
  }
}

// Opens a live socket and collects its messages; rejects if the handshake is refused.
function listen(code, headers = {Origin: base}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase}/api/room/live?code=${code}`, {headers});
    const messages = [];
    const waiters = [];
    socket.onmessage = event => { messages.push(event.data); for (const waiter of waiters.splice(0)) waiter(); };
    let cursor = 0;
    socket.onopen = () => resolve({
      socket, messages,
      /** Returns the next unread message, waiting for it if necessary. */
      async next(timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (messages.length <= cursor) {
          if (Date.now() > deadline) throw new Error("no live message within timeout");
          await new Promise(done => { waiters.push(done); setTimeout(done, 100); });
        }
        return messages[cursor++];
      },
    });
    socket.onerror = () => reject(new Error("handshake refused"));
  });
}
const closed = socket => new Promise(resolve => { if (socket.readyState === WebSocket.CLOSED) resolve({code: 1006}); else socket.addEventListener("close", resolve, {once: true}); });

{
  const [host, guest, other] = await Promise.all([new Client().init(), new Client().init(), new Client().init()]);
  const created = await host.call({action: "create", name: "实时房主", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey});
  assert.equal(created.status, 200, JSON.stringify(created));
  const code = created.data.code;

  // Handshakes: only same-origin WebSocket upgrades for an existing room.
  const plain = await fetch(`${base}/api/room/live?code=${code}`, {headers: {Origin: base}});
  assert.equal(plain.status, 426);
  assert.ok(plain.headers.get("content-security-policy"), "rejections carry the security headers");
  assert.ok(plain.headers.get("x-request-id"));
  await assert.rejects(listen(code, {Origin: "https://not-this-site.example"}), /refused/, "cross-site handshakes are refused");
  await assert.rejects(listen(code, {}), /refused/, "handshakes without Origin are refused");
  await assert.rejects(listen("000000"), /refused/, "unknown rooms are refused");
  await assert.rejects(listen("abc"), /refused/, "malformed codes are refused");

  // A seated host and a not-yet-seated visitor both receive signals.
  const hostLive = await listen(code, {Origin: base, Cookie: host.cookie});
  const visitorLive = await listen(code);
  hostLive.socket.send("ping");
  assert.equal(await hostLive.next(), "pong", "keep-alive pings are answered");

  const joined = await guest.call({action: "join", code, name: "实时玩家", seat: 2});
  assert.equal(joined.status, 200, JSON.stringify(joined));
  for (const live of [hostLive, visitorLive]) {
    const signal = JSON.parse(await live.next());
    assert.deepEqual(Object.keys(signal).sort(), ["type", "version"], "signals carry only a version");
    assert.equal(signal.type, "changed");
    assert.equal(signal.version, joined.data.version, "signal announces the committed version");
  }

  // Rejected actions commit nothing and announce nothing.
  assert.equal((await other.call({action: "join", code, name: "抢座", seat: 2})).status, 409);
  const ready = await host.call({action: "ready", code, ready: true});
  assert.equal(ready.status, 200);
  const next = JSON.parse(await visitorLive.next());
  assert.equal(next.version, ready.data.version, "the failed join produced no signal; the next one is the ready");
  assert.equal(next.version, joined.data.version + 1);
  for (const message of [...hostLive.messages, ...visitorLive.messages]) {
    assert.ok(!/实时|merlin|assassin|role|name|key/i.test(message), `signal leaks nothing: ${message}`);
  }

  // Anything other than a ping closes the socket.
  visitorLive.socket.send("hello");
  assert.equal((await closed(visitorLive.socket)).code, 1003);
  hostLive.socket.close(1000);
  await closed(hostLive.socket);
  console.log("PASS v0.9 live signals: same-origin handshake, unknown rooms refused, version-only broadcasts to members and visitors, pings, no signal for rejected actions");
}
