import test from "node:test";
import assert from "node:assert/strict";
import {format, msg, pickLang, translate, translateServer} from "../lib/i18n/core.ts";
import {EN} from "../lib/i18n/dictionary.ts";
import {check} from "../scripts/i18n-check.mjs";

test("every Chinese interface text and server message has an English entry", async () => {
  const problems = await check();
  assert.deepEqual(problems, [], `${problems.length} translation problem(s):\n${problems.slice(0, 40).join("\n")}`);
});

test("language choice: cookie first, then the browser, Chinese for zh", () => {
  assert.equal(pickLang("en", "zh-CN"), "en");
  assert.equal(pickLang("zh", "en-US"), "zh");
  assert.equal(pickLang(undefined, "zh-TW,zh;q=0.9,en;q=0.8"), "zh");
  assert.equal(pickLang(undefined, "en-GB,en;q=0.9"), "en");
  assert.equal(pickLang(undefined, "ja-JP"), "en");
  assert.equal(pickLang("fr", ""), "zh", "unknown cookie values are ignored; no header means Chinese");
  assert.equal(pickLang(null, null), "zh");
  assert.equal(pickLang(undefined, "*"), "zh");
  assert.equal(pickLang(undefined, "*;q=0.5"), "zh");
});

test("translate falls back to Chinese and fills named placeholders", () => {
  assert.equal(format("还差 {n} 位", {n: 2}), "还差 2 位");
  assert.equal(format("{a}{missing}", {a: 1}), "1{missing}");
  assert.equal(translate("zh", "没有这条翻译 {x}", {x: 1}), "没有这条翻译 1");
  assert.equal(translate("en", "没有这条翻译 {x}", {x: 1}), "没有这条翻译 1", "missing entries show Chinese instead of nothing");
  assert.equal(msg("原样返回"), "原样返回");
  const [zh, en] = Object.entries(EN).find(([key]) => !/\{/.test(key));
  assert.equal(translate("en", zh), en);
  assert.equal(translate("zh", zh), zh);
});

test("server messages translate exactly or by pattern, with inserted values translated too", () => {
  assert.equal(translateServer("zh", "房间不存在或已过期，请检查房间码。"), "房间不存在或已过期，请检查房间码。");
  assert.equal(translateServer("en", "完全未知的消息"), "完全未知的消息");
  assert.equal(translateServer("en", "房间不存在或已过期，请检查房间码。"), EN["房间不存在或已过期，请检查房间码。"]);
  assert.equal(translateServer("en", "本次任务需要选择 3 人。"), EN["本次任务需要选择 {0} 人。"].replace("{0}", "3"));
  const merlinOnce = translateServer("en", "梅林只能加入一位。");
  assert.ok(merlinOnce.includes(EN["梅林"]) && !/[一-鿿]/.test(merlinOnce), merlinOnce);
});
