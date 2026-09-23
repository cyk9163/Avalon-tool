import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startedGame } from "./helpers";

// Automated accessibility audit (v1.10): WCAG 2.1 A/AA rules on the main
// screens. Serious and critical findings fail the test.
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter(violation => violation.impact === "serious" || violation.impact === "critical");
  const summary = serious.map(violation => `${violation.id}: ${violation.nodes.slice(0, 3).map(node => node.target.join(" ")).join(" | ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

test("home, rules and privacy pages pass the accessibility audit", async ({ page }) => {
  for (const path of ["/", "/rules", "/privacy", "/me"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await audit(page, path);
  }
});

test("the game screens pass the accessibility audit", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const page = await game.leader.open(game.code);
    await audit(page, "leader during team building");
    const other = await game.other.open(game.code);
    const { turnId } = (await game.leader.get(game.code)).game!;
    await game.leader.call({ action: "propose", code: game.code, turnId, team: [game.leader.seat, game.other.seat] });
    await expect(other.getByRole("button", { name: "赞成", exact: true })).toBeVisible({ timeout: 5_000 });
    await audit(other, "voting");
    const invite = (await game.leader.get(game.code) as unknown as { inviteToken: string }).inviteToken;
    const screen = await other.context().newPage();
    await screen.goto(`/screen?room=${game.code}&invite=${invite}`);
    await expect(screen.locator(".big-screen-phase")).toContainText("全员表决");
    await audit(screen, "big screen");
  } finally {
    await game.close();
  }
});

test("the light theme passes the same audit, contrast included, and the choice sticks", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    await game.leader.context.addCookies([{ name: "avalon_theme", value: "light", url: process.env.E2E_BASE_URL ?? "http://localhost:5173" }]);
    const page = await game.leader.open(game.code);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await audit(page, "light: leader during team building");
    for (const path of ["/rules", "/privacy", "/me"]) { await page.goto(path); await audit(page, `light: ${path}`); }
    // Switching back to dark takes effect at once and survives a reload.
    await page.getByRole("button", { name: "切换到深色主题" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  } finally {
    await game.close();
  }
});
