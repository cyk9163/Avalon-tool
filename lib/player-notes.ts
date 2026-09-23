"use client";

// Private deduction notes (v1.1): each player may mark the others as Good /
// Evil or as a role on this board, and jot down what they said. Notes live in
// this device's localStorage only — they are never sent to the server — and
// are kept per room and per game, so a rematch starts with a clean sheet.
import { useCallback, useSyncExternalStore } from "react";
import { ROLES, type Role } from "./game.ts";

export type Side = "good" | "evil";
export type Mark = { side?: Side; role?: Role };
export type PlayerNotes = { marks: Record<number, Mark>; notes: Record<number, string> };

export const MAX_NOTE_LENGTH = 300;
const PREFIX = "avalon:notes:";
const INDEX_KEY = "avalon:notes-index";
const KEEP_GAMES = 5;
const EMPTY: PlayerNotes = { marks: {}, notes: {} };

const cache = new Map<string, PlayerNotes>();
const listeners = new Set<() => void>();

export function notesKey(code: string, round: number): string {
  return `${PREFIX}${code}:${round}`;
}

/** Keeps only well-formed seats, sides, roles and notes. */
export function sanitizeNotes(value: unknown, roles: readonly Role[]): PlayerNotes {
  const result: PlayerNotes = { marks: {}, notes: {} };
  if (!value || typeof value !== "object") return result;
  const { marks, notes } = value as Record<string, unknown>;
  const seat = (key: string) => (/^(?:[1-9]|10)$/.test(key) ? Number(key) : null);
  if (marks && typeof marks === "object") {
    for (const [key, mark] of Object.entries(marks as Record<string, unknown>)) {
      const index = seat(key);
      if (index === null || !mark || typeof mark !== "object") continue;
      const { side, role } = mark as Record<string, unknown>;
      const clean: Mark = {};
      if (typeof role === "string" && roles.includes(role as Role)) { clean.role = role as Role; clean.side = ROLES[role as Role].side; }
      else if (side === "good" || side === "evil") clean.side = side;
      if (clean.side) result.marks[index] = clean;
    }
  }
  if (notes && typeof notes === "object") {
    for (const [key, note] of Object.entries(notes as Record<string, unknown>)) {
      const index = seat(key);
      if (index !== null && typeof note === "string" && note.trim()) result.notes[index] = note.slice(0, MAX_NOTE_LENGTH);
    }
  }
  return result;
}

function read(key: string, roles: readonly Role[]): PlayerNotes {
  const cached = cache.get(key);
  if (cached) return cached;
  let value = EMPTY;
  try { value = sanitizeNotes(JSON.parse(localStorage.getItem(key) || "null"), roles); } catch { /* storage unavailable */ }
  cache.set(key, value);
  return value;
}

function write(key: string, value: PlayerNotes) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Remember recent games and drop the oldest notes, so storage never grows without bound.
    const index = (JSON.parse(localStorage.getItem(INDEX_KEY) || "[]") as unknown[]).filter((item): item is string => typeof item === "string" && item !== key);
    index.push(key);
    for (const old of index.splice(0, Math.max(0, index.length - KEEP_GAMES))) localStorage.removeItem(old);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch { /* private mode: notes still work until the page closes */ }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key?.startsWith(PREFIX)) { cache.delete(event.key); listener(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** Notes for one room and game, shared live by every component that shows them. */
export function usePlayerNotes(code: string, round: number, roles: readonly Role[]) {
  const key = notesKey(code, round);
  const notes = useSyncExternalStore(subscribe, () => read(key, roles), () => EMPTY);
  const setMark = useCallback((seat: number, mark: Mark | null) => {
    const current = read(key, roles);
    const marks = { ...current.marks };
    if (mark?.role) marks[seat] = { role: mark.role, side: ROLES[mark.role].side };
    else if (mark?.side) marks[seat] = { side: mark.side };
    else delete marks[seat];
    write(key, { ...current, marks });
  }, [key, roles]);
  const setNote = useCallback((seat: number, text: string) => {
    const current = read(key, roles);
    const notesBySeat = { ...current.notes };
    if (text) notesBySeat[seat] = text.slice(0, MAX_NOTE_LENGTH); else delete notesBySeat[seat];
    write(key, { ...current, notes: notesBySeat });
  }, [key, roles]);
  const clear = useCallback(() => write(key, { marks: {}, notes: {} }), [key]);
  return { notes, setMark, setNote, clear };
}
