import test from "node:test";
import assert from "node:assert/strict";
import {BUILT_IN_TEMPLATES, MAX_SAVED_TEMPLATES, fillCustomRoles, sameBoard, sanitizeTemplates, templateFits, templateMinimum} from "../lib/board-templates.ts";
import {validateCustomRoles, EVIL_COUNTS} from "../lib/game.ts";
import {replayFileName, replayText} from "../lib/replay.ts";

test("every built-in template is a valid custom board from its minimum player count up", () => {
  assert.ok(BUILT_IN_TEMPLATES.length >= 4);
  assert.ok(BUILT_IN_TEMPLATES.some(template => templateMinimum(template) === 5), "small tables have at least one template");
  assert.equal(new Set(BUILT_IN_TEMPLATES.map(template => template.id)).size, BUILT_IN_TEMPLATES.length);
  for (const template of BUILT_IN_TEMPLATES) {
    const minimum = templateMinimum(template);
    assert.ok(minimum !== null, template.id);
    for (const capacity of [5, 6, 7, 8, 9, 10]) {
      assert.equal(templateFits(template, capacity), capacity >= minimum, `${template.id} @ ${capacity}`);
      if (capacity >= minimum) {
        const roles = fillCustomRoles(capacity, template.specials);
        assert.equal(roles.length, capacity);
        assert.deepEqual(validateCustomRoles(capacity, roles), roles, "the server accepts the filled board");
      }
    }
  }
});

test("template minimums follow evil slots, expansion roles and the Lady of the Lake", () => {
  assert.equal(templateMinimum({specials: ["merlin", "assassin"], ladyOfLake: false}), 5);
  assert.equal(templateMinimum({specials: ["merlin", "assassin"], ladyOfLake: true}), 7, "lady needs 7");
  assert.equal(templateMinimum({specials: ["merlin", "percival", "cleric", "assassin", "morgana"], ladyOfLake: false}), 7, "expansion role needs 7");
  assert.equal(templateMinimum({specials: ["merlin", "percival", "assassin", "morgana", "mordred", "oberon"], ladyOfLake: false}), 10, "four evil specials need ten players");
  assert.equal(EVIL_COUNTS[10], 4);
  assert.equal(templateMinimum({specials: ["merlin", "percival", "assassin", "morgana", "mordred", "oberon", "lunatic"], ladyOfLake: false}), null);
});

test("saved templates are sanitized: unknown roles, bad ids, unplayable boards and overflow are dropped", () => {
  const good = {id: "t-1a2b3c4d", name: "  周五局  ", specials: ["merlin", "assassin", "percival", "morgana", "hacker"], ladyOfLake: true};
  const result = sanitizeTemplates([
    good,
    {id: "BAD ID", name: "x", specials: ["merlin", "assassin"], ladyOfLake: false},
    {id: "t-2", name: "", specials: ["merlin", "assassin"], ladyOfLake: false},
    {id: "t-3", name: "没有刺客", specials: ["merlin"], ladyOfLake: false},
    {id: "t-4", name: "不可能", specials: ["merlin", "percival", "assassin", "morgana", "mordred", "oberon", "lunatic"], ladyOfLake: false},
    null, 42, "text",
  ]);
  assert.deepEqual(result, [{id: "t-1a2b3c4d", name: "周五局", specials: ["merlin", "assassin", "percival", "morgana"], ladyOfLake: true}]);
  assert.deepEqual(sanitizeTemplates({}), []);
  const many = Array.from({length: 20}, (_, index) => ({id: `t-${index}`, name: `模板${index}`, specials: ["merlin", "assassin"], ladyOfLake: false}));
  assert.equal(sanitizeTemplates(many).length, MAX_SAVED_TEMPLATES);
  assert.equal(sanitizeTemplates([{...good, name: "一二三四五六七八九十十一十二十三"}])[0].name.length, 12);
  assert.ok(sameBoard(result[0], new Set(["assassin", "merlin", "percival", "morgana"]), true));
  assert.ok(!sameBoard(result[0], new Set(["assassin", "merlin", "percival", "morgana"]), false));
});

function finishedRoom(overrides = {}) {
  return {
    code: "123456", round: 2, capacity: 5, preset: "classic", roles: ["merlin", "percival", "loyal", "loyal", "assassin", "morgana"].slice(0, 5).concat([]), ladyOfLake: false,
    phase: "finished", hostId: "a", hostRevision: 0, resetReason: null, version: 40,
    players: [1, 2, 3, 4, 5].map(seat => ({id: `p${seat}`, name: ["", "小明", "阿花", "老王", "Kiki", "大雄"][seat], seat, ready: true, confirmed: true})),
    meId: "p1", identity: null, expiresAt: 0, firstLeader: 1, namesHidden: false, inviteToken: null, recoveryCode: null,
    takeoverRequests: [], myTakeover: null, takeoversOfMySeat: [], recoveries: [],
    game: {
      quest: 4, leaderSeat: 3, rejections: 0, teamSize: 3, failsRequired: 1, turnId: "x", team: [], votedSeats: [], myTeamVote: null,
      submittedQuestCount: 0, myQuestVote: null, allowedQuestCards: ["success"],
      proposals: [
        {id: "a", quest: 1, attempt: 1, leaderSeat: 1, team: [1, 2], votes: [{seat: 1, approve: true}, {seat: 2, approve: true}, {seat: 3, approve: false}, {seat: 4, approve: true}, {seat: 5, approve: false}], approved: true},
        {id: "b", quest: 2, attempt: 1, leaderSeat: 2, team: [2, 3, 5], votes: [{seat: 1, approve: false}, {seat: 2, approve: true}, {seat: 3, approve: false}, {seat: 4, approve: false}, {seat: 5, approve: true}], approved: false},
      ],
      quests: [{quest: 1, team: [1, 2], failCount: 0, success: true}, {quest: 2, team: [2, 3, 4], failCount: 1, success: false}],
      result: {winner: "evil", reason: "merlin-assassinated", targetSeat: 1},
      lake: {holderSeat: 2, usedSeats: [2], pending: false, myChecks: [{quest: 2, targetSeat: 5, side: "evil"}]},
      publicReveals: [],
      revealedRoles: [{seat: 1, role: "merlin"}, {seat: 2, role: "percival"}, {seat: 3, role: "loyal"}, {seat: 4, role: "assassin"}, {seat: 5, role: "morgana"}],
    },
    ...overrides,
  };
}

test("the replay lists result, identities, quests and every vote", () => {
  const room = finishedRoom();
  room.roles = ["merlin", "percival", "loyal", "assassin", "morgana"];
  const text = replayText(room, new Date(2026, 8, 23, 21, 5));
  assert.match(text, /^圆桌 · 阿瓦隆复盘\n2026-09-23 21:05 · 第 2 局 · 5 人 · 经典局\n/);
  assert.match(text, /角色：梅林、派西维尔、亚瑟的忠臣、刺客、莫甘娜/);
  assert.match(text, /结果：邪恶获胜（刺客找到了梅林） · 刺杀目标：1 号 小明/);
  assert.match(text, /1 号 小明 — 梅林（正义）/);
  assert.match(text, /5 号 大雄 — 莫甘娜（邪恶）/);
  assert.match(text, /任务 2：失败 · 队员 2、3、4 号 · 2 张成功牌、1 张失败牌/);
  assert.match(text, /任务 1 第 1 次 · 队长 1 号 小明 · 队员 1、2 号 → 通过（赞成 3：1、2、4 号；反对 2：3、5 号）/);
  assert.match(text, /任务 2 第 1 次 .* → 否决（赞成 2：2、5 号；反对 3：1、3、4 号）/);
  assert.ok(!text.includes("123456"), "the room code is not exported");
  assert.ok(!/湖中|查验/.test(text), "private lake results are not exported");
  assert.equal(replayFileName(room, new Date(2026, 8, 23, 21, 5)), "avalon-replay-20260923-2105-r2.txt");
});

test("the replay needs a result and hides identities from non-members", () => {
  const room = finishedRoom();
  room.roles = ["merlin", "percival", "loyal", "assassin", "morgana"];
  assert.equal(replayText({...room, game: {...room.game, result: null}}), null);
  assert.equal(replayText({...room, game: null}), null);
  const outsider = replayText({...room, meId: null, game: {...room.game, revealedRoles: null}});
  assert.match(outsider, /完整身份仅向本局成员揭晓。/);
  assert.ok(!outsider.includes("梅林（正义）"));
});

test("the English replay has no Chinese text apart from player nicknames", () => {
  const room = finishedRoom({ladyOfLake: true, preset: "mist"});
  room.roles = ["merlin", "percival", "loyal", "assassin", "morgana"];
  room.game.publicReveals = [{seat: 5, role: "morgana"}];
  const text = replayText(room, new Date(2026, 8, 23, 21, 5), "en");
  assert.match(text, /^Round Table · Avalon recap\n2026-09-23 21:05 · Game 2 · 5 players · /);
  assert.match(text, /Quest 1, attempt 1 · Leader #1 小明 · Team #1, #2 → /);
  const nicknames = room.players.map(player => player.name).filter(Boolean);
  const stripped = nicknames.reduce((result, nickname) => result.split(nickname).join(""), text);
  assert.ok(!/[㐀-鿿　-〿！-～]/.test(stripped), stripped);
  assert.equal(replayText(room, new Date(2026, 8, 23, 21, 5), "zh"), replayText(room, new Date(2026, 8, 23, 21, 5)), "Chinese stays the default");
});
