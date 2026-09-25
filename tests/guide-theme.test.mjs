import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pickTheme} from "../lib/theme.ts";
import {buildLightTheme, lightColor} from "../scripts/theme-light.mjs";

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
