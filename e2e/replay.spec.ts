import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, startedGame } from "./helpers";

test("a member can step through the replay, and the result is saved on this device", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const code = game.code;
    const identities = await Promise.all(game.players.map(player => player.get(code)));
    const sides = identities.map(view => (view as { identity: { side: "good" | "evil" } }).identity.side);
    for (let mission = 1; mission <= 3; mission++) {
      const before = await game.players[0].get(code);
      const size = before.game!.teamSize;
      const evil = sides.findIndex(side => side === "evil") + 1;
      const team = [evil];
      for (let seat = 1; seat <= 5 && team.length < size; seat++) if (!team.includes(seat)) team.push(seat);
      team.sort((a, b) => a - b);
      const turnId = before.game!.turnId;
      await game.players[before.game!.leaderSeat - 1].call({ action: "propose", code, turnId, team });
      for (const player of game.players) await player.call({ action: "vote", code, turnId, approve: true });
      const questing = await game.players[0].get(code);
      expect(questing.phase).toBe("quest");
      let failed = false;
      for (const seat of team) {
        const evilPlayer = sides[seat - 1] === "evil";
        const card = evilPlayer && !failed ? "fail" : "success";
        if (card === "fail") failed = true;
        await game.players[seat - 1].call({ action: "quest", code, turnId: questing.game!.turnId, card });
      }
    }
    expect((await game.players[0].get(code)).phase).toBe("finished");

    const page = await game.leader.open(code);
    const replay = page.getByRole("region", { name: "回放" });
    await expect(replay).toBeVisible();
    await expect(replay.getByRole("button", { name: "上一步" })).toBeDisabled();
    const caption = replay.locator(".replay-caption");
    const first = await caption.innerText();
    await replay.getByRole("button", { name: "下一步" }).click();
    await expect(caption).not.toHaveText(first);
    await expectNoHorizontalScroll(page);

    await page.goto("/me");
    await expect(page.getByRole("heading", { name: "我的战绩" })).toBeVisible();
    await expect(page.locator(".record-stat").first()).toContainText(/[01] 胜 \/ 1 局/);
  } finally {
    await game.close();
  }
});
