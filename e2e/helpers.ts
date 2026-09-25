import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Public local-test Key (see .dev.vars.example); never a real host Key.
export const TEST_HOST_KEY = "AVL-TEST-KEYS-2345-6789";
const ORIGIN = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").origin;
export const NAMES = ["小明", "阿花", "老王", "Kiki", "大雄"];

type RoomView = {
  code: string;
  phase: string;
  game: { leaderSeat: number; turnId: string; teamSize: number; team: number[] } | null;
};

/** One seated player: a phone browser context whose cookie jar holds that seat's device cookie. */
export class Player {
  constructor(readonly context: BrowserContext, readonly seat: number) {}

  async call(body: Record<string, unknown>): Promise<RoomView> {
    const response = await this.context.request.post("/api/room", { data: body, headers: { Origin: ORIGIN } });
    const data = await response.json();
    expect(response.status(), `${String(body.action)}: ${JSON.stringify(data)}`).toBe(200);
    return data as RoomView;
  }

  async get(code: string): Promise<RoomView> {
    return (await this.context.request.get(`/api/room?code=${code}`)).json() as Promise<RoomView>;
  }

  async open(code: string): Promise<Page> {
    const page = await this.context.newPage();
    await page.goto(`/?room=${code}`);
    await expect(page.locator(".room-section-status")).toHaveAttribute("aria-label", /实时|已同步/);
    return page;
  }
}

/** Five phones seated, identities confirmed and the first quest begun. */
export async function startedGame(browser: Browser, options?: { turnSpeech?: boolean }) {
  const players: Player[] = [];
  for (let seat = 1; seat <= 5; seat++) {
    const context = await browser.newContext();
    await context.request.get("/api/room?session=1");
    players.push(new Player(context, seat));
  }
  const [host, ...guests] = players;
  const { code } = await host.call({ action: "create", name: NAMES[0], capacity: 5, preset: "classic", turnSpeech: options?.turnSpeech === true, requestId: crypto.randomUUID(), hostKey: TEST_HOST_KEY });
  for (const guest of guests) await guest.call({ action: "join", code, name: NAMES[guest.seat - 1], seat: guest.seat });
  for (const player of players) await player.call({ action: "ready", code, ready: true });
  await host.call({ action: "start", code });
  for (const player of players) await player.call({ action: "confirm", code });
  const view = await host.call({ action: "begin", code });
  const leaderSeat = view.game!.leaderSeat;
  return {
    code,
    players,
    leader: players[leaderSeat - 1],
    other: players[leaderSeat % 5],
    close: () => Promise.all(players.map(player => player.context.close())),
  };
}

/** No page may scroll sideways on a phone. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
