import test from "node:test";
import assert from "node:assert/strict";
import { careerAchievementIds, gameAchievementIds, gameFact, rankTracks } from "../lib/achievements.ts";

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
  assert.ok(ids.includes("tenure-1"));
  assert.equal(ids.includes("tenure-2"), false);
  assert.ok(ids.includes("mvp-rank-1"));
  assert.ok(ids.includes("mvp-rank-2"));
  assert.equal(ids.includes("mvp-rank-3"), false);
  assert.ok(ids.includes("both-sides"));
  assert.ok(ids.includes("many-faces"));
});

test("the assassin who knives Morgana gets that joke, not a generic teammate stab", () => {
  const ids = gameAchievementIds({
    ...base,
    role: "assassin",
    side: "evil",
    result: { winner: "good", reason: "assassin-missed", targetSeat: 3 },
    seats: [{ seat: 1, role: "assassin" }, { seat: 2, role: "merlin" }, { seat: 3, role: "morgana" }],
  });
  assert.ok(ids.includes("stab-morgana"));
  assert.ok(ids.includes("blade-missed"));
  assert.equal(ids.includes("stab-ally"), false);
});

test("Percival can hug Morgana, and evil can vote down a teammate's team", () => {
  const hugged = gameAchievementIds({
    ...base,
    role: "percival",
    seat: 2,
    merlinSeat: 4,
    proposals: [{ team: [3], quest: 1, approved: true, votes: [{ seat: 2, approve: true }] }],
    seats: [{ seat: 3, role: "morgana" }, { seat: 4, role: "merlin" }],
  });
  assert.ok(hugged.includes("wrong-thigh"));
  const sold = gameAchievementIds({
    ...base,
    role: "assassin",
    seat: 1,
    side: "evil",
    proposals: [{ team: [3], votes: [{ seat: 1, approve: false }], approved: false }],
    seats: [{ seat: 1, role: "assassin" }, { seat: 3, role: "morgana" }],
  });
  assert.ok(sold.includes("sold-teammate"));
});

test("a unanimous pass that fails, a lone fail card, and riding a quest that succeeds as evil", () => {
  const crash = gameAchievementIds({
    ...base,
    role: "loyal",
    proposals: [{ team: [1, 2], quest: 1, approved: true, votes: [{ seat: 1, approve: true }, { seat: 2, approve: true }] }],
    quests: [{ team: [1, 2], quest: 1, success: false, failCount: 1 }],
    cards: [{ quest: 1, card: "fail", success: false, failCount: 1 }],
  });
  assert.ok(crash.includes("unanimous-crash"));
  assert.ok(crash.includes("solo-fail"));
  const cover = gameAchievementIds({
    ...base,
    role: "minion",
    side: "evil",
    result: { winner: "evil", reason: "three-failures" },
    quests: [{ team: [1, 2], success: true }],
  });
  assert.ok(cover.includes("deep-cover"));
});

test("an assassin rank needs both enough knives and a high enough hit rate", () => {
  const hit = (fact) => ({ role: "assassin", side: "evil", winner: fact === "hit" ? "evil" : "good", mvp: 0, fact });
  const sharp = [hit("hit"), hit("hit"), hit("hit"), hit("miss")];
  const ids = careerAchievementIds(sharp);
  assert.ok(ids.includes("blade-1"));
  assert.ok(ids.includes("blade-2"));
  assert.equal(ids.includes("blade-3"), false);
  const wild = [hit("hit"), hit("miss"), hit("miss"), hit("miss")];
  assert.equal(careerAchievementIds(wild).includes("blade-1"), false);
  const blade = rankTracks(sharp).find(track => track.id === "blade");
  assert.equal(blade.statVars.n, 4);
  assert.equal(blade.statVars.p, 75);
  assert.equal(gameFact("assassin", { reason: "merlin-assassinated" }), "hit");
  assert.equal(gameFact("assassin", { reason: "assassin-missed" }), "miss");
  assert.equal(gameFact("merlin", { reason: "quests" }), null);
});
