import test from "node:test";
import assert from "node:assert/strict";
import {MAX_DRAFT_LENGTH, MAX_NOTE_LENGTH, MARK_GLYPH, clueMarks, markChangeAllowed, markGlyph, notesKey, sanitizeNotes, visibleMarks} from "../lib/player-notes.ts";

const board = ["merlin", "percival", "loyal", "assassin", "morgana"];

test("each mark is a single distinct character", () => {
  const glyphs = Object.values(MARK_GLYPH);
  assert.equal(new Set(glyphs).size, glyphs.length);
  for (const glyph of glyphs) assert.equal([...glyph].length, 1);
  assert.equal(markGlyph({side: "good"}), "好");
  assert.equal(markGlyph({side: "evil"}), "坏");
  assert.equal(markGlyph({role: "merlin", side: "good"}), "梅");
});

test("notes are kept per room, per game, and per player", () => {
  assert.equal(notesKey("123456", 1, "alice"), "avalon:notes:123456:1:alice");
  assert.notEqual(notesKey("123456", 1, "alice"), notesKey("123456", 2, "alice"), "a rematch gets a fresh sheet");
  assert.notEqual(notesKey("123456", 1, "alice"), notesKey("123456", 1, "bob"), "another player cannot read these marks");
});

test("stored notes are cleaned: only real seats, sides, roles on this board and trimmed text survive", () => {
  const cleaned = sanitizeNotes({
    marks: {1: {side: "good"}, 2: {role: "morgana"}, 3: {role: "oberon", side: "evil"}, 4: {role: "morgana", side: "good"}, 11: {side: "evil"}, x: {side: "evil"}, 5: {side: "maybe"}, 6: null},
    notes: {1: "说自己是忠臣", 2: "   ", 3: "x".repeat(MAX_NOTE_LENGTH + 50), 12: "no seat", 4: 42},
  }, board);
  assert.deepEqual(cleaned.marks, {
    1: {side: "good"},
    2: {role: "morgana", side: "evil"},
    3: {side: "evil"},                     // a role not on this board falls back to its side
    4: {role: "morgana", side: "evil"},    // a role always carries its own side
  });
  assert.deepEqual(Object.keys(cleaned.notes), ["1", "3"]);
  assert.equal(cleaned.notes[3].length, MAX_NOTE_LENGTH);
  for (const junk of [null, undefined, 7, "text", []]) assert.deepEqual(sanitizeNotes(junk, board), {marks: {}, notes: {}, draft: ""});
});

test("the speaking draft is kept, capped, and blank drafts are dropped", () => {
  assert.equal(sanitizeNotes({draft: "先表水，再推 3 号上车"}, board).draft, "先表水，再推 3 号上车");
  assert.equal(sanitizeNotes({draft: "字".repeat(MAX_DRAFT_LENGTH + 20)}, board).draft.length, MAX_DRAFT_LENGTH);
  assert.equal(sanitizeNotes({draft: "   "}, board).draft, "");
  assert.equal(sanitizeNotes({draft: 12}, board).draft, "");
});

test("evil teammates are fixed role marks, and Merlin starts on 坏 but may name an evil role", () => {
  const evil = clueMarks({ role: "assassin", known: [{ seat: 2, label: "莫甘娜" }, { seat: 4, label: "已知邪恶" }] });
  assert.deepEqual(evil.locked[2], { role: "morgana", side: "evil" });
  assert.equal(evil.locked[4], undefined);
  assert.equal(markChangeAllowed(2, null, evil), false);
  assert.deepEqual(visibleMarks({ 2: { side: "good" } }, evil)[2], { role: "morgana", side: "evil" });

  const merlin = clueMarks({ role: "merlin", known: [{ seat: 3, label: "已知邪恶" }, { seat: 5, label: "刺客" }] }, 1);
  assert.deepEqual(merlin.merlinSeats, [3]);
  assert.deepEqual(merlin.locked[1], { role: "merlin", side: "good" });
  assert.equal(markChangeAllowed(1, null, merlin), false);
  assert.deepEqual(visibleMarks({}, merlin)[3], { side: "evil" });
  assert.deepEqual(visibleMarks({ 3: { role: "assassin", side: "evil" } }, merlin)[3], { role: "assassin", side: "evil" });
  assert.deepEqual(visibleMarks({ 3: { side: "good" } }, merlin)[3], { side: "evil" });
  assert.equal(markChangeAllowed(3, { role: "morgana", side: "evil" }, merlin), true);
  assert.equal(markChangeAllowed(3, { side: "good" }, merlin), false);
  assert.equal(markChangeAllowed(3, null, merlin), false);

  assert.deepEqual(clueMarks({ role: "oberon", known: [{ seat: 2, label: "刺客" }] }).locked, {});
});
