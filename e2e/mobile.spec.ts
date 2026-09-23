import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, Player, startedGame, TEST_HOST_KEY } from "./helpers";

const seatButton = (page: Page, seat: number) =>
  page.locator("#room-game .game-table").getByRole("button", { name: new RegExp(`^${seat} 号`) });

test("public pages fit the phone without sideways scrolling", async ({ page }) => {
  for (const path of ["/", "/rules", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("the leader shows a team on the table, changes it and calls the vote; the table sees it live", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const leaderPage = await game.leader.open(game.code);
    const otherPage = await game.other.open(game.code);
    expect(leaderPage.viewportSize()!.width, "phone-sized context").toBeLessThan(500);
    await expect(otherPage.locator(".room-section-status")).toHaveAttribute("aria-label", "实时");

    // Pick on the round table; the action bar stays fixed at the bottom of the screen.
    const third = game.players.find(player => player !== game.leader && player !== game.other)!;
    await seatButton(leaderPage, game.leader.seat).click();
    await seatButton(leaderPage, game.other.seat).click();
    await expect(seatButton(leaderPage, game.other.seat)).toHaveAttribute("aria-pressed", "true");
    const footer = leaderPage.locator(".game-action-footer");
    await expect(footer).toBeInViewport({ ratio: 1 });
    const box = await footer.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(leaderPage.viewportSize()!.height + 1);

    // 亮车: everyone else sees the shown team without reloading.
    await leaderPage.getByRole("button", { name: "亮车" }).click();
    const draft = otherPage.locator(".draft-view");
    await expect(draft).toContainText("队长亮车", { timeout: 5_000 });
    await expect(draft).toContainText(`${game.other.seat}`);

    // 改车 after the table has talked.
    await seatButton(leaderPage, game.other.seat).click();
    await seatButton(leaderPage, third.seat).click();
    await leaderPage.getByRole("button", { name: "改车" }).click();
    await expect(draft.locator(".team-member b")).toHaveText([game.leader.seat, third.seat].sort((a, b) => a - b).map(String), { timeout: 5_000 });

    // 发起表决 behind a confirmation.
    await leaderPage.getByRole("button", { name: "发起表决" }).click();
    await leaderPage.getByRole("alertdialog").getByRole("button", { name: "发起表决" }).click();

    // The other phone gets the vote buttons in reach, votes and is locked in.
    const approve = otherPage.getByRole("button", { name: "赞成", exact: true });
    await expect(approve).toBeInViewport({ timeout: 5_000 });
    await approve.click();
    await otherPage.getByRole("alertdialog").getByRole("button", { name: "确认赞成" }).click();
    await expect(otherPage.getByText("你的表决已锁定，等待全员揭晓。")).toBeVisible();
    // The leader's table marks that seat as voted, live.
    await expect(leaderPage.locator("#room-game .game-table").getByRole("img", { name: new RegExp(`^${game.other.seat} 号.*已表决`) })).toBeVisible({ timeout: 5_000 });

    await expectNoHorizontalScroll(leaderPage);
    await expectNoHorizontalScroll(otherPage);
  } finally {
    await game.close();
  }
});

test("the identity card shows only while held and hides when the app loses focus", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const page = await game.other.open(game.code);
    await page.locator("#room-identity > summary").click();
    const surface = page.locator(".identity-surface");
    const reveal = page.locator(".reveal-button");
    await reveal.scrollIntoViewIfNeeded();
    await expect(surface).not.toHaveClass(/revealed/);

    const box = (await reveal.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(surface).toHaveClass(/revealed/);
    await expect(surface.locator(".side-label")).toBeVisible();
    await page.mouse.up();
    await expect(surface).not.toHaveClass(/revealed/);

    // Switching apps (window blur) hides it even while the finger is still down.
    await page.mouse.down();
    await expect(surface).toHaveClass(/revealed/);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(surface).not.toHaveClass(/revealed/);
    await page.mouse.up();
  } finally {
    await game.close();
  }
});

test("losing the network shows reconnecting and the room recovers by itself", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const page = await game.other.open(game.code);
    const status = page.locator(".room-section-status");
    await game.other.context.setOffline(true);
    await expect(status).toHaveAttribute("aria-label", "重连中", { timeout: 20_000 });

    // Something happens at the table while this phone is offline.
    const view = await game.leader.get(game.code);
    await game.leader.call({ action: "draft", code: game.code, turnId: view.game!.turnId, team: [game.leader.seat] });

    await game.other.context.setOffline(false);
    await expect(status).toHaveAttribute("aria-label", /实时|已同步/, { timeout: 20_000 });
    await expect(page.locator(".draft-view")).toContainText("队长亮车", { timeout: 20_000 });
  } finally {
    await game.close();
  }
});

test("speaking turns pass round the table and the tab title tells whose move it is", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const leaderPage = await game.leader.open(game.code);
    const otherPage = await game.other.open(game.code);   // the next seat speaks second
    await expect(leaderPage).toHaveTitle(/^● 轮到你发言/);
    await expect(otherPage.locator(".speech-now")).toContainText(`正在发言：${game.leader.seat} 号`);
    await leaderPage.getByRole("button", { name: "我说完了" }).click();
    await expect(leaderPage).toHaveTitle(/^● 轮到你选队/);
    await expect(otherPage).toHaveTitle(/^● 轮到你发言/, { timeout: 5_000 });
    await expect(otherPage.locator(".speech-order li.current")).toHaveText(String(game.other.seat));
    await otherPage.getByRole("button", { name: "我说完了" }).click();
    await expect(otherPage).not.toHaveTitle(/^●/);
  } finally {
    await game.close();
  }
});

test("a resolved team vote is revealed on every phone and can be skipped", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const page = await game.other.open(game.code);
    const { turnId } = (await game.leader.get(game.code)).game!;
    await game.leader.call({ action: "propose", code: game.code, turnId, team: [game.leader.seat, game.other.seat] });
    for (const player of game.players) await player.call({ action: "vote", code: game.code, turnId, approve: player.seat !== game.other.seat });
    const overlay = page.locator(".reveal-overlay");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await expect(overlay.locator(".reveal-ballot")).toHaveCount(5);
    await expect(overlay.locator(".reveal-result")).toContainText("通过");
    await expect(overlay.locator(".reveal-result")).toContainText("4 赞成 · 1 反对");
    await overlay.getByRole("button", { name: "跳过" }).click();
    await expect(overlay).toBeHidden();
  } finally {
    await game.close();
  }
});

test("tapping a role name opens what that role sees, who sees it and its cards", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await context.request.get("/api/room?session=1");
    const host = new Player(context, 1);
    const { code } = await host.call({ action: "create", name: "小明", capacity: 5, preset: "classic", requestId: crypto.randomUUID(), hostKey: TEST_HOST_KEY });
    const page = await context.newPage();
    await page.goto(`/?room=${code}`);
    // Every lobby card spans the full phone width (v1.6 rules card once pushed the grid into two columns).
    await expect(page.locator(".rules-card")).toBeVisible();
    const widths = await page.locator(".room-layout > .room-table, .room-side > *").evaluateAll(cards => cards.map(card => card.getBoundingClientRect().width));
    const layout = await page.locator(".room-layout").evaluate(element => element.getBoundingClientRect().width);
    for (const width of widths) expect(width).toBeGreaterThan(layout - 2);
    await page.locator(".config-card").getByRole("button", { name: "查看角色说明：梅林" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("除莫德雷德外的所有邪恶玩家");
    await expect(dialog).toContainText("只能出成功");
    await expectNoHorizontalScroll(page);
  } finally {
    await context.close();
  }
});

test("big-screen mode shows the public table live, with no roles and no buttons", async ({ browser }) => {
  const game = await startedGame(browser);
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: true });
  try {
    const invite = (await game.leader.get(game.code) as unknown as { inviteToken: string }).inviteToken;
    const screen = await tablet.newPage();
    await screen.goto(`/screen?room=${game.code}&invite=${invite}`);
    await expect(screen.locator(".big-screen-phase")).toContainText("组建队伍");
    await expect(screen).toHaveURL(new RegExp(`/screen[?]room=${game.code}$`), { timeout: 5_000 });
    await expect(screen.locator(".big-screen button:not(.theme-toggle)")).toHaveCount(0);   // only the theme switch
    const { turnId } = (await game.leader.get(game.code)).game!;
    await game.leader.call({ action: "propose", code: game.code, turnId, team: [game.leader.seat, game.other.seat] });
    await expect(screen.locator(".big-screen-phase")).toContainText("全员表决", { timeout: 5_000 });
    for (const player of game.players) await player.call({ action: "vote", code: game.code, turnId, approve: true });
    await expect(screen.locator(".reveal-overlay .reveal-result")).toContainText("通过", { timeout: 5_000 });
    await expect(screen.locator(".identity-card, .revealed-roles, .lake-private-result")).toHaveCount(0);
    // Without the invite the screen shows no game.
    const bare = await tablet.newPage();
    await bare.goto(`/screen?room=${game.code}`);
    await expect(bare.locator(".big-screen-waiting")).toContainText("大屏模式");
  } finally {
    await tablet.close();
    await game.close();
  }
});

test("the beginner hint says what to do now and stays off once closed", async ({ browser }) => {
  const game = await startedGame(browser);
  try {
    const page = await game.other.open(game.code);
    const hint = page.locator(".guide-hint");
    await expect(hint).toContainText("等队长亮车");
    await hint.getByRole("button", { name: "关闭新手提示" }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".room-section-status")).toBeVisible();
    await expect(hint).toHaveCount(0);
  } finally {
    await game.close();
  }
});
