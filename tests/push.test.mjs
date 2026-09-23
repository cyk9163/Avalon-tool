import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { GameError } from "../lib/game.ts";
import { newlyOnTurn, pushNotice, seatTurn } from "../lib/turn.ts";
import { requirePushMember, validatePushSubscription } from "../lib/push-subscription.ts";
import { bytesToBase64Url, decryptPushPayloadFor, sendWebPush } from "../lib/web-push.ts";
import { VAPID_PUBLIC_KEY } from "../lib/vapid-public.ts";

function room(phase, game, players = [{ id: "p1", seat: 1, role: "merlin" }, { id: "p2", seat: 2, role: "assassin" }]) {
  return { phase, capacity: players.length, players, game };
}

test("a turn prompt matches the on-screen rules and only new prompts are pushed", () => {
  const speaking = room("team", { turnId: "t", leaderSeat: 1, team: [], teamVotes: {}, questVotes: {}, speech: { turnId: "t", index: 1, startedAt: 1 } });
  assert.equal(seatTurn(speaking, "p2"), "轮到你发言");
  assert.equal(seatTurn(speaking, "p1"), "轮到你选队", "the leader is prompted once the speaker is someone else");
  const voting = room("vote", { turnId: "t", leaderSeat: 1, team: [1], teamVotes: { 1: true }, questVotes: {} });
  assert.equal(seatTurn(voting, "p1"), null);
  assert.equal(seatTurn(voting, "p2"), "轮到你投票");
  const quest = room("quest", { turnId: "t", leaderSeat: 1, team: [2], teamVotes: {}, questVotes: {} });
  assert.equal(seatTurn(quest, "p1"), null);
  assert.equal(seatTurn(quest, "p2"), "轮到你出任务牌");
  const lake = room("lake", { turnId: "t", leaderSeat: 1, team: [], teamVotes: {}, questVotes: {}, lake: { holderSeat: 2 } });
  assert.equal(seatTurn(lake, "p2"), "轮到你使用湖中仙女");
  const strike = room("assassination", { turnId: "t", leaderSeat: 1, team: [], teamVotes: {}, questVotes: {} });
  assert.equal(seatTurn(strike, "p2"), "轮到你刺杀");
  assert.equal(seatTurn(strike, "p1"), null);

  const before = new Map([["p2", "轮到你投票"]]);
  const after = new Map([["p2", "轮到你投票"], ["p1", "轮到你出任务牌"]]);
  assert.deepEqual(newlyOnTurn(before, after), [{ id: "p1", label: "轮到你出任务牌" }]);
  assert.deepEqual(newlyOnTurn(before, new Map([["p2", "轮到你出任务牌"]])), [{ id: "p2", label: "轮到你出任务牌" }]);
  const notice = pushNotice("轮到你投票", "123456");
  assert.equal(notice, "轮到你投票 · 房间 123456");
  assert.equal(pushNotice("轮到你投票", "123456", "en"), "Your turn to vote · room 123456");
  assert.doesNotMatch(notice, /梅林|刺客|身份/);
});

test("only a seated player can store an https push subscription", () => {
  const table = { players: [{ id: "p1", key: "device" }] };
  assert.equal(requirePushMember(table, "device").id, "p1");
  assert.throws(() => requirePushMember(table, "other"), /请先加入房间/);
  const keys = { p256dh: "A".repeat(80), auth: "B".repeat(20) };
  assert.throws(() => validatePushSubscription({ endpoint: "http://push.example/send", ...keys }), GameError);
  assert.throws(() => validatePushSubscription({ endpoint: "https://127.0.0.1/push", ...keys }), /推送订阅无效/);
  assert.throws(() => validatePushSubscription({ endpoint: "https://push.example/send", p256dh: "abc", auth: "def" }), /推送订阅无效/);
});

test("a push to a local endpoint is a signed aes128gcm request and decrypts to the notice", async () => {
  const subscriber = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const target = {
    endpoint: "",
    p256dh: bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", subscriber.publicKey))),
    auth: bytesToBase64Url(auth),
  };
  const signing = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const privateKey = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", signing.privateKey)));
  let captured;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      captured = { headers: request.headers, body: Buffer.concat(chunks) };
      response.writeHead(201);
      response.end();
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    target.endpoint = `http://127.0.0.1:${port}/push`;
    const status = await sendWebPush(target, { body: "轮到你投票 · 房间 123456", url: "/?room=123456" }, privateKey);
    assert.equal(status, 201);
    assert.match(captured.headers.authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${VAPID_PUBLIC_KEY}$`));
    assert.equal(captured.headers["content-encoding"], "aes128gcm");
    assert.equal(captured.headers.ttl, "120");
    const notice = JSON.parse(await decryptPushPayloadFor(captured.body, subscriber, auth));
    assert.deepEqual(notice, { body: "轮到你投票 · 房间 123456", url: "/?room=123456" });
    assert.equal(await sendWebPush(target, { body: "x", url: "/?room=123456" }, ""), 0);
    await assert.rejects(sendWebPush(target, { body: "x", url: "/secret" }, privateKey));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
