import test from "node:test";
import assert from "node:assert/strict";
import { careerAchievementIds, gameAchievementIds } from "../lib/achievements.ts";

const base = {
  role: "merlin",
  seat: 1,
  side: "good",
  result: { winner: "good", reason: "quests" },
  quests: [{ team: [2, 3], success: true }],
  proposals: [],
};

test("Merlin who survives the game earns the living Merlin title", () => {
  assert.ok(gameAchievementIds(base).includes("merlin-lives"));
});

test("an early assassination that hits earns the impatient blade, a miss earns the missed blade", () => {
  const hit = gameAchievementIds({ ...base, role: "assassin", side: "evil", result: { winner: "evil", reason: "merlin-assassinated", early: true } });
  assert.ok(hit.includes("impatient-blade"));
  const miss = gameAchievementIds({ ...base, role: "assassin", side: "evil", result: { winner: "good", reason: "assassin-missed" } });
  assert.ok(miss.includes("blade-missed"));
});

test("riding every failed quest as evil, or a failed quest as good, is its own moment", () => {
  const quests = [{ team: [1, 2], success: false }, { team: [1, 3], success: false }];
  assert.ok(gameAchievementIds({ ...base, role: "minion", side: "evil", result: { winner: "evil", reason: "quests" }, quests }).includes("saboteur"));
  assert.ok(gameAchievementIds({ ...base, role: "servant", quests }).includes("scapegoat"));
});

test("approving your own team is ordinary; voting it down is the joke", () => {
  const proposals = [
    { team: [1, 2], votes: [{ seat: 1, approve: false }] },
    { team: [3], votes: [{ seat: 1, approve: true }] },
    { team: [4], votes: [{ seat: 1, approve: true }] },
  ];
  assert.ok(gameAchievementIds({ ...base, proposals }).includes("rejected-own-car"));
});

test("career titles count games, MVPs, both sides and roles", () => {
  const games = [
    { role: "merlin", side: "good", winner: "good", mvp: 1 },
    { role: "assassin", side: "evil", winner: "evil", mvp: 0 },
    { role: "percival", side: "good", winner: "good", mvp: 1 },
    { role: "morgana", side: "evil", winner: "evil", mvp: 1 },
  ];
  const ids = careerAchievementIds(games);
  assert.ok(ids.includes("first-table"));
  assert.ok(ids.includes("mvp-thrice"));
  assert.ok(ids.includes("both-sides"));
  assert.ok(ids.includes("many-faces"));
  assert.equal(ids.includes("regular"), false);
});
