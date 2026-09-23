import test from "node:test";
import assert from "node:assert/strict";
import { replaySteps } from "../lib/replay-steps.ts";
import { finalSide, gameHighlights } from "../lib/highlights.ts";
import { MAX_PERSONAL_GAMES, personalStats, recordFromView, rememberGame, sanitizeRecord } from "../lib/personal-record.ts";
import { replayText } from "../lib/replay.ts";

const roles = [
  { seat: 1, role: "merlin" },
  { seat: 2, role: "percival" },
  { seat: 3, role: "loyal" },
  { seat: 4, role: "assassin" },
  { seat: 5, role: "morgana" },
];

function vote(approvals) {
  return [1, 2, 3, 4, 5].map(seat => ({ seat, approve: approvals.includes(seat) }));
}

function proposal(quest, attempt, leaderSeat, team, approvals, approved) {
  return { id: `${quest}-${attempt}`, quest, attempt, leaderSeat, team, votes: vote(approvals), approved };
}

function baseGame(overrides = {}) {
  return {
    quest: 3, leaderSeat: 1, rejections: 0, teamSize: 2, failsRequired: 1, turnId: "t", team: [], votedSeats: [],
    myTeamVote: null, submittedQuestCount: 0, myQuestVote: null, allowedQuestCards: ["success"],
    proposals: [
      proposal(1, 1, 1, [3, 5], [2, 4], false),
      proposal(1, 2, 2, [1, 2], [1, 2, 3], true),
      proposal(2, 1, 3, [2, 3, 4], [2, 3, 4], true),
    ],
    quests: [
      { quest: 1, team: [1, 2], failCount: 0, success: true },
      { quest: 2, team: [2, 3, 4], failCount: 1, success: false },
    ],
    result: { winner: "evil", reason: "merlin-assassinated", targetSeat: 1 },
    lake: { holderSeat: 5, usedSeats: [3], pending: false, myChecks: [{ quest: 2, targetSeat: 5, side: "evil" }] },
    publicReveals: [], loyalty: null, lancelotsSwitched: false, draftTeam: [], speech: null,
    revealedRoles: roles,
    questCards: [
      { quest: 1, cards: [{ seat: 1, card: "success" }, { seat: 2, card: "success" }] },
      { quest: 2, cards: [{ seat: 2, card: "success" }, { seat: 3, card: "success" }, { seat: 4, card: "fail" }] },
    ],
    ...overrides,
  };
}

const name = seat => `${seat}号`;

test("replay steps follow proposals, then the quest, then this viewer's lake hand-off", () => {
  const steps = replaySteps(baseGame(), 3);
  assert.deepEqual(steps.map(step => step.kind), ["proposal", "proposal", "quest", "proposal", "quest", "lake"]);
  assert.equal(steps[0].approved, false);
  assert.equal(steps[0].good, 0);
  assert.equal(steps[2].kind, "quest");
  assert.equal(steps[2].success, true);
  assert.equal(steps[2].good, 1);
  assert.deepEqual(steps[2].cards, [{ seat: 1, card: "success" }, { seat: 2, card: "success" }]);
  assert.equal(steps[4].kind, "quest");
  assert.equal(steps[4].evil, 1);
  assert.equal(steps[5].kind, "lake");
  assert.deepEqual({ from: steps[5].fromSeat, to: steps[5].toSeat }, { from: 3, to: 5 });
  assert.equal("side" in steps[5], false, "the private check result is not a replay step");
});

test("quest card authors appear only once the view includes them", () => {
  const hidden = replaySteps(baseGame({ questCards: null }), 1);
  assert.ok(hidden.some(step => step.kind === "quest"));
  assert.ok(hidden.filter(step => step.kind === "quest").every(step => step.cards === null));
  const shown = replaySteps(baseGame(), 1);
  assert.ok(shown.filter(step => step.kind === "quest").every(step => Array.isArray(step.cards) && step.cards.length > 0));
});

test("spectators and unfinished games have no replay", () => {
  const game = baseGame();
  assert.deepEqual(replaySteps({ ...game, revealedRoles: null }, 1), []);
  assert.deepEqual(replaySteps(game, null), []);
  assert.deepEqual(replaySteps({ ...game, result: null }, 1), []);
  assert.deepEqual(replaySteps(null, 1), []);
});

test("highlights pick at most four, in a fixed order, and skip a quiet game", () => {
  const loud = baseGame({
    proposals: [
      proposal(1, 1, 1, [4, 5], [], false),
      proposal(1, 2, 2, [4, 5], [], false),
      proposal(1, 3, 3, [4, 5], [], false),
      proposal(1, 4, 4, [4, 5], [4, 5], true),
      proposal(2, 1, 5, [4, 5], [4, 5], true),
      proposal(3, 1, 1, [1, 4], [1, 2], true),
    ],
    quests: [
      { quest: 1, team: [4, 5], failCount: 1, success: false },
      { quest: 2, team: [4, 5], failCount: 1, success: false },
      { quest: 3, team: [1, 4], failCount: 1, success: false },
    ],
    result: { winner: "evil", reason: "merlin-assassinated", early: true },
  });
  // Merlin (1) rejected the first five teams and approved the last, which contains Merlin.
  // Percival (2) rejected teams without Merlin and approved the last one.
  loud.proposals[5].votes = vote([1, 2]);
  const lines = gameHighlights(loud, roles, name, "、");
  assert.equal(lines.length, 4);
  assert.equal(lines[0].key, "坏人 {players} 上了所有失败的任务。");
  assert.equal(lines[0].vars.players, "4号");
  assert.equal(lines[1].key, "梅林 {n} 次反对里，有 {m} 次反对的是后来失败的任务。");
  assert.deepEqual(lines[1].vars, { n: 5, m: 2 });
  assert.equal(lines[2].vars.k, 1);
  assert.equal(lines[3].key, "刺客提前出刀就锁定了梅林。");
  assert.ok(!lines.some(line => line.key.includes("连续否决")), "the fifth rule loses when four are already filled");

  const quiet = baseGame({
    revealedRoles: [
      { seat: 1, role: "merlin" }, { seat: 2, role: "loyal" }, { seat: 3, role: "loyal" },
      { seat: 4, role: "assassin" }, { seat: 5, role: "minion" },
    ],
    proposals: [
      proposal(1, 1, 1, [1, 2], [1, 2, 3, 4, 5], true),
      proposal(2, 1, 2, [1, 3], [1, 2, 3, 4, 5], true),
      proposal(3, 1, 3, [2, 3], [1, 2, 3, 4, 5], true),
    ],
    quests: [
      { quest: 1, team: [1, 2], failCount: 1, success: false },
      { quest: 2, team: [1, 3], failCount: 1, success: false },
      { quest: 3, team: [2, 3], failCount: 1, success: false },
    ],
    result: { winner: "evil", reason: "three-failures" },
    lake: null,
  });
  assert.deepEqual(gameHighlights(quiet, quiet.revealedRoles, name, "、"), []);
  assert.deepEqual(gameHighlights(baseGame(), null, name, "、"), []);
});

test("each highlight rule stands on its own", () => {
  const missed = baseGame({ result: { winner: "good", reason: "assassin-missed", targetSeat: 2 }, quests: [], proposals: [] });
  assert.deepEqual(gameHighlights(missed, roles, name, "、").map(line => line.key), ["刺客没有找到梅林。"]);

  const hit = baseGame({ result: { winner: "evil", reason: "merlin-assassinated", targetSeat: 1 }, quests: [], proposals: [] });
  assert.equal(gameHighlights(hit, roles, name, "、")[0].key, "刺客锁定了梅林。");

  const rejected = baseGame({
    result: { winner: "evil", reason: "five-rejections" },
    quests: [],
    revealedRoles: [{ seat: 1, role: "loyal" }],
    proposals: [1, 2, 3, 4].map(attempt => proposal(1, attempt, attempt, [1, 2], [], false)),
  });
  const streak = gameHighlights(rejected, rejected.revealedRoles, name, "、");
  assert.equal(streak.length, 1);
  assert.deepEqual(streak[0].vars, { quest: 1, n: 4 });

  assert.equal(finalSide("evilLancelot", true), "good");
  assert.equal(finalSide("goodLancelot", true), "evil");
  const switched = baseGame({
    lancelotsSwitched: true,
    revealedRoles: [{ seat: 4, role: "goodLancelot" }, { seat: 5, role: "evilLancelot" }],
    proposals: [proposal(1, 1, 1, [4], [4], true)],
    quests: [{ quest: 1, team: [4], failCount: 1, success: false }],
    result: { winner: "evil", reason: "three-failures" },
  });
  const villains = gameHighlights(switched, switched.revealedRoles, name, "、");
  assert.equal(villains[0].vars.players, "4号", "a switched good Lancelot counts as evil");
});

test("the text recap includes highlights and still hides lake results", () => {
  const room = {
    code: "123456", round: 1, capacity: 5, preset: "classic", roles: roles.map(item => item.role), ladyOfLake: false,
    phase: "finished", hostId: "p1", hostRevision: 0, resetReason: null, version: 1,
    players: [1, 2, 3, 4, 5].map(seat => ({ id: `p${seat}`, name: `N${seat}`, seat, ready: true, confirmed: true })),
    meId: "p1", identity: null, expiresAt: 0, firstLeader: 1, namesHidden: false, inviteToken: null, recoveryCode: null,
    takeoverRequests: [], myTakeover: null, takeoversOfMySeat: [], recoveries: [], history: [],
    game: baseGame(),
  };
  const text = replayText(room, new Date(2026, 8, 23, 12, 0));
  assert.match(text, /【高光】\n坏人 /);
  assert.match(text, /刺客锁定了梅林。/);
  assert.ok(!/查验|属于正义|属于邪恶/.test(text));
  const english = replayText(room, new Date(2026, 8, 23, 12, 0), "en");
  assert.match(english, /\[Highlights\][\s\S]*The Assassin pinned Merlin\./);
  const stripped = ["N1", "N2", "N3", "N4", "N5"].reduce((result, nickname) => result.split(nickname).join(""), english);
  assert.ok(!/[㐀-鿿　-〿！-～]/.test(stripped), stripped);
});

function sample(code, round, role, side, winner, assassinHit) {
  return { code, round, at: round, capacity: 5, preset: "classic", ladyOfLake: false, role, side, winner, won: side === winner, assassinHit };
}

test("personal results stay on one row per game and cap at 200", () => {
  const junk = sanitizeRecord([
    sample("123456", 1, "merlin", "good", "evil", true),
    sample("123456", 1, "assassin", "evil", "evil", false),
    { code: "12", round: 1, role: "merlin" },
    null,
    sample("123456", 2, "percival", "good", "good", false),
  ]);
  assert.equal(junk.length, 2);
  assert.equal(junk[0].role, "merlin");
  assert.equal(junk[0].won, false);
  const many = Array.from({ length: MAX_PERSONAL_GAMES + 5 }, (_, index) => sample(String(100000 + index).slice(0, 6), 1, "loyal", "good", "good", false));
  // codes need to be unique 6-digit; 100000+index works until 100205
  const capped = sanitizeRecord(many.filter(item => /^\d{6}$/.test(item.code)));
  assert.equal(capped.length, MAX_PERSONAL_GAMES);
  assert.equal(capped[0].code, many[5].code, "the oldest rows are dropped");
  const again = rememberGame(capped, capped[0]);
  assert.equal(again, capped, "the same room and round is not stored twice");
});

test("personal stats count wins, sides, roles and times Merlin was found", () => {
  const games = [
    sample("111111", 1, "merlin", "good", "evil", true),
    sample("111111", 2, "merlin", "good", "good", false),
    sample("222222", 1, "assassin", "evil", "evil", true),
  ];
  const stats = personalStats(games);
  assert.equal(stats.total, 3);
  assert.equal(stats.won, 2);
  assert.deepEqual(stats.bySide.good, { played: 2, won: 1 });
  assert.deepEqual(stats.bySide.evil, { played: 1, won: 1 });
  assert.equal(stats.merlinPlayed, 2);
  assert.equal(stats.merlinHit, 1);
  assert.deepEqual(stats.recent.map(game => game.round), [1, 2, 1]);
  assert.equal(stats.byRole[0].role, "merlin");
});

test("a finished member is recorded once; a spectator is not", () => {
  const room = {
    code: "654321", round: 3, capacity: 5, preset: "classic", ladyOfLake: false,
    players: [{ id: "p1", seat: 1 }, { id: "p4", seat: 4 }],
    meId: "p1",
    game: baseGame({ lancelotsSwitched: false }),
  };
  const entry = recordFromView(room, 1_700_000_000_000);
  assert.equal(entry.role, "merlin");
  assert.equal(entry.side, "good");
  assert.equal(entry.won, false);
  assert.equal(entry.assassinHit, true);
  assert.equal(recordFromView({ ...room, meId: null }, 1), null);
  assert.equal(recordFromView({ ...room, game: { ...room.game, revealedRoles: null } }, 1), null);
  const stored = rememberGame(rememberGame([], entry), { ...entry, at: 5 });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].at, entry.at);
});
