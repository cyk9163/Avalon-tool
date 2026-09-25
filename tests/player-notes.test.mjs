import test from "node:test";
import assert from "node:assert/strict";
import {MAX_DRAFT_LENGTH, MAX_NOTE_LENGTH, MARK_GLYPH, markGlyph, notesKey, sanitizeNotes} from "../lib/player-notes.ts";

const board = ["merlin", "percival", "loyal", "assassin", "morgana"];

test("each mark is a single distinct character", () => {
  const glyphs = Object.values(MARK_GLYPH);
  assert.equal(new Set(glyphs).size, glyphs.length);
  for (const glyph of glyphs) assert.equal([...glyph].length, 1);
  assert.equal(markGlyph({side: "good"}), "好");
  assert.equal(markGlyph({side: "evil"}), "坏");
  assert.equal(markGlyph({role: "merlin", side: "good"}), "梅");
});

test("notes are kept per room and per game", () => {
  assert.equal(notesKey("123456", 1), "avalon:notes:123456:1");
  assert.notEqual(notesKey("123456", 1), notesKey("123456", 2), "a rematch gets a fresh sheet");
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
