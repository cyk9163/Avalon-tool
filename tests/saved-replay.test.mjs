import test from "node:test";
import assert from "node:assert/strict";
import { parseStoredReplay, publicReplay, replayGame, savedReplay } from "../lib/saved-replay.ts";
import { replaySteps } from "../lib/replay-steps.ts";

const merlin = "a".repeat(32);
const assassin = "b".repeat(32);

test("a saved recap keeps quest cards and only the viewer's lake check", () => {
  const stored = savedReplay({
    capacity: 5,
    players: [
      { seat: 1, name: "湖月", role: "merlin", accountId: merlin },
      { seat: 2, name: "阿凯", role: "assassin", accountId: assassin },
    ],
    game: {
      result: { winner: "evil", reason: "merlin-assassinated", targetSeat: 1 },
      proposals: [{ id: "1", quest: 1, attempt: 1, leaderSeat: 2, team: [1, 2], votes: [{ seat: 1, approve: true }, { seat: 2, approve: false }], approved: true }],
      quests: [{ quest: 1, team: [1, 2], failCount: 1, success: false }],
      questReceipts: [{ turnId: "t", votes: [{ seat: 1, card: "success" }, { seat: 2, card: "fail" }] }],
      lake: { checks: [
        { quest: 1, viewerSeat: 1, targetSeat: 2, side: "evil" },
        { quest: 1, viewerSeat: 2, targetSeat: 1, side: "good" },
      ] },
    },
  });
  const parsed = parseStoredReplay(JSON.parse(JSON.stringify(stored)));
  const mine = publicReplay(parsed, merlin);
  assert.equal(mine.meSeat, 1);
  assert.deepEqual(mine.checks, [{ quest: 1, targetSeat: 2, side: "evil" }]);
  assert.equal(JSON.stringify(mine).includes(assassin), false);
  const steps = replaySteps(replayGame(mine), mine.meSeat);
  assert.equal(steps.some(step => step.kind === "quest" && step.cards?.some(card => card.seat === 2 && card.card === "fail")), true);
  assert.equal(publicReplay(parsed, "c".repeat(32)), null);
});
