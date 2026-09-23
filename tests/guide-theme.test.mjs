import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mutateRoom, roomView, rolePool} from "../lib/game.ts";
import {guideHint} from "../lib/guide.ts";
import {pickTheme} from "../lib/theme.ts";
import {buildLightTheme, lightColor} from "../scripts/theme-light.mjs";

function sample() {
  return {
    code: "123456", capacity: 5, preset: "classic", phase: "ready", hostId: "p0",
    players: rolePool(5, "classic").map((role, i) => ({id: `p${i}`, key: `k${i}`, name: `玩家${i + 1}`, seat: i + 1, ready: true, confirmed: true, role})),
    createdAt: Date.now(), expiresAt: Date.now() + 86400000, requestId: "guide", firstLeader: 5,
  };
}
const view = (room, seat) => roomView(room, `k${seat - 1}`, 1);
const act = (room, seat, action, input = {}) => mutateRoom(room, `k${seat - 1}`, action, input);

test("the beginner hint follows the player's own next step", () => {
  const room = sample();
  assert.match(guideHint(view(room, 1)).text, /房主开始对局/);
  act(room, 1, "begin");
  assert.match(guideHint(view(room, 5)).text, /轮到你发言/, "the leader speaks first");
  assert.match(guideHint(view(room, 2)).text, /等队长亮车/);
  const {turnId} = view(room, 1).game;
  act(room, 5, "speech", {turnId, step: "next", index: 0});
  const leader = guideHint(view(room, 5));
  assert.match(leader.text, /你是队长/);
  assert.deepEqual(leader.vars, {n: 2});
  act(room, 5, "draft", {turnId, team: [1, 2]});
  assert.match(guideHint(view(room, 3)).text, /队长亮车了/);
  act(room, 5, "propose", {turnId, team: [1, 2]});
  assert.match(guideHint(view(room, 3)).text, /^投票/);
  for (const seat of [1, 2, 3, 4, 5]) act(room, seat, "vote", {turnId, approve: true});
  assert.match(guideHint(view(room, 1)).text, /你在车上/);
  assert.match(guideHint(view(room, 3)).text, /等车上的人/);
  assert.equal(guideHint({...view(room, 1), meId: null}), null, "visitors get no hint in a game");
});

test("the light theme flips lightness but keeps hue, alpha and dark shadows", () => {
  const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  assert.ok(luminance(lightColor("#0c171a")) > 0.85, "dark page → light page");
  assert.ok(luminance(lightColor("#f4f0e6")) < 0.15, "light text → dark text");
  const gold = lightColor("#dbc18a");
  assert.ok(luminance(gold) > 0.2 && luminance(gold) < 0.45, `gold stays a mid, readable gold (${gold})`);
  assert.equal(lightColor("#ffffff0d").slice(-2), "0d", "alpha is kept");
  assert.equal(lightColor("#00000025", "box-shadow"), "#00000013", "a dark shadow stays dark, softer");
  assert.equal(pickTheme("light"), "light");
  assert.equal(pickTheme("purple"), "dark");
  assert.equal(pickTheme(undefined), "dark");
});

test("app/theme-light.css is generated from the current stylesheets", () => {
  assert.equal(readFileSync("app/theme-light.css", "utf8").replace(/\r\n/g, "\n"), buildLightTheme(), "run npm run theme:build");
  assert.ok(!readFileSync("app/theme-light.css", "utf8").includes(".entry-panel"), "the create-room card keeps its own light colours");
});
