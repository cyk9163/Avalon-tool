import test from "node:test";
import assert from "node:assert/strict";
import { mvpSeat } from "../lib/mvp.ts";

test("a side's MVP is the unique top vote, including a vote for yourself", () => {
  const votes = [
    { accountId: "a", seat: 1, side: "good" },
    { accountId: "b", seat: 1, side: "good" },
    { accountId: "c", seat: 2, side: "good" },
    { accountId: "d", seat: 4, side: "evil" },
    { accountId: "e", seat: 5, side: "evil" },
  ];
  assert.equal(mvpSeat(votes, "good"), 1);
  assert.equal(mvpSeat(votes, "evil"), null);
});
