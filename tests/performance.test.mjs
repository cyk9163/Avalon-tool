import test from "node:test";
import assert from "node:assert/strict";
import { performanceScore } from "../lib/performance.ts";

const seats = [
  { seat: 1, role: "merlin" },
  { seat: 2, role: "loyal" },
  { seat: 3, role: "percival" },
  { seat: 4, role: "assassin" },
  { seat: 5, role: "morgana" },
];

test("a good vote is yes on a clean team and no on a team with evil", () => {
  const score = performanceScore({
    seat: 2, side: "good", role: "loyal", seats,
    result: { winner: "good", reason: "assassin-missed" },
    proposals: [
      { quest: 1, team: [1, 2], votes: [{ seat: 2, approve: true }] },
      { quest: 2, team: [2, 4], votes: [{ seat: 2, approve: false }] },
    ],
  });
  assert.equal(score, 100);
});

test("an evil vote is yes on a wolf team and no on a clean team", () => {
  const score = performanceScore({
    seat: 4, side: "evil", role: "minion", seats,
    result: { winner: "evil", reason: "three-failures" },
    proposals: [
      { quest: 1, team: [1, 2], votes: [{ seat: 4, approve: false }] },
      { quest: 2, team: [4, 5], votes: [{ seat: 4, approve: true }] },
    ],
    cards: [{ quest: 2, card: "fail" }],
  });
  assert.equal(score, 100);
});

test("a fail card from evil counts, a fail card from good does not", () => {
  const evil = performanceScore({
    seat: 4, side: "evil", role: "assassin", seats,
    result: { winner: "evil", reason: "merlin-assassinated" },
    cards: [{ quest: 1, card: "fail" }],
  });
  const good = performanceScore({
    seat: 2, side: "good", role: "loyal", seats,
    result: { winner: "good", reason: "assassin-missed" },
    cards: [{ quest: 1, card: "fail" }],
  });
  assert.equal(evil, 100);
  assert.equal(good, 0);
});

test("a game with nothing to read still gets a result-based score", () => {
  assert.equal(performanceScore({
    seat: 1, side: "good", role: "loyal",
    result: { winner: "good", reason: "three-failures" },
  }), 60);
  assert.equal(performanceScore({
    seat: 4, side: "evil", role: "loyal",
    result: { winner: "good", reason: "three-failures" },
  }), 40);
});
