"use client";

// Personal results on this device only (v1.12). Nothing here is sent to the
// server. One entry per room code and round, newest games kept, 200 at most.
import { useCallback, useSyncExternalStore } from "react";
import { PRESETS, ROLES, type GameView, type Preset, type Role, type RoomView } from "./game.ts";
import { finalSide } from "./highlights.ts";

export const MAX_PERSONAL_GAMES = 200;
const KEY = "avalon:personal-record";

export type PersonalGame = {
  code: string;
  round: number;
  at: number;
  capacity: number;
  preset: Preset;
  ladyOfLake: boolean;
  role: Role;
  side: "good" | "evil";
  winner: "good" | "evil";
  won: boolean;
  // The assassin found Merlin this game (whether or not I was Merlin).
  assassinHit: boolean;
};

export type SideCount = { played: number; won: number };
export type PersonalStats = {
  total: number;
  won: number;
  byRole: { role: Role; played: number; won: number }[];
  bySide: { good: SideCount; evil: SideCount };
  merlinPlayed: number;
  merlinHit: number;
  recent: PersonalGame[];
};

const EMPTY_SIDE: SideCount = { played: 0, won: 0 };

function isRole(value: unknown): value is Role {
  return typeof value === "string" && Object.hasOwn(ROLES, value);
}
function isPreset(value: unknown): value is Preset {
  return typeof value === "string" && Object.hasOwn(PRESETS, value);
}

/** Drops malformed rows and duplicate room/round pairs. Keeps the newest 200. */
export function sanitizeRecord(value: unknown): PersonalGame[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const games: PersonalGame[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.code !== "string" || !/^\d{6}$/.test(row.code)) continue;
    if (!Number.isInteger(row.round) || (row.round as number) < 1 || (row.round as number) > 99) continue;
    const id = `${row.code}:${row.round}`;
    if (seen.has(id)) continue;
    if (!Number.isInteger(row.at) || (row.at as number) < 0) continue;
    if (!Number.isInteger(row.capacity) || (row.capacity as number) < 5 || (row.capacity as number) > 10) continue;
    if (!isPreset(row.preset) || typeof row.ladyOfLake !== "boolean" || !isRole(row.role)) continue;
    if (row.side !== "good" && row.side !== "evil") continue;
    if (row.winner !== "good" && row.winner !== "evil") continue;
    if (typeof row.assassinHit !== "boolean") continue;
    seen.add(id);
    games.push({
      code: row.code,
      round: row.round as number,
      at: row.at as number,
      capacity: row.capacity as number,
      preset: row.preset,
      ladyOfLake: row.ladyOfLake,
      role: row.role,
      side: row.side,
      winner: row.winner,
      won: row.side === row.winner,
      assassinHit: row.assassinHit,
    });
  }
  return games.slice(-MAX_PERSONAL_GAMES);
}

/** Appends a game unless this room and round were already stored. */
export function rememberGame(games: PersonalGame[], game: PersonalGame): PersonalGame[] {
  const [clean] = sanitizeRecord([game]);
  if (!clean) return games;
  if (games.some(item => item.code === clean.code && item.round === clean.round)) return games;
  return [...games, clean].slice(-MAX_PERSONAL_GAMES);
}

export function personalStats(games: PersonalGame[]): PersonalStats {
  const byRole = new Map<Role, SideCount>();
  const bySide: PersonalStats["bySide"] = { good: { ...EMPTY_SIDE }, evil: { ...EMPTY_SIDE } };
  let won = 0;
  let merlinPlayed = 0;
  let merlinHit = 0;
  for (const game of games) {
    if (game.won) won += 1;
    const role = byRole.get(game.role) ?? { played: 0, won: 0 };
    role.played += 1;
    if (game.won) role.won += 1;
    byRole.set(game.role, role);
    bySide[game.side].played += 1;
    if (game.won) bySide[game.side].won += 1;
    if (game.role === "merlin") {
      merlinPlayed += 1;
      if (game.assassinHit) merlinHit += 1;
    }
  }
  return {
    total: games.length,
    won,
    byRole: [...byRole].map(([role, count]) => ({ role, ...count })).sort((a, b) => b.played - a.played || a.role.localeCompare(b.role)),
    bySide,
    merlinPlayed,
    merlinHit,
    recent: games.slice(-10).reverse(),
  };
}

/** One record for the viewer of a finished game, or null for spectators. */
export function recordFromView(room: Pick<RoomView, "code" | "round" | "capacity" | "preset" | "ladyOfLake" | "players" | "meId" | "game">, at: number): PersonalGame | null {
  const game: GameView | null = room.game;
  const me = room.players.find(player => player.id === room.meId);
  const mine = me && game?.revealedRoles?.find(player => player.seat === me.seat);
  if (!game?.result || !mine) return null;
  const side = finalSide(mine.role, game.lancelotsSwitched);
  return {
    code: room.code,
    round: room.round,
    at,
    capacity: room.capacity,
    preset: room.preset,
    ladyOfLake: room.ladyOfLake,
    role: mine.role,
    side,
    winner: game.result.winner,
    won: side === game.result.winner,
    assassinHit: game.result.reason === "merlin-assassinated",
  };
}

const EMPTY_GAMES: PersonalGame[] = [];
let cache: PersonalGame[] | null = null;
const listeners = new Set<() => void>();

function read(): PersonalGame[] {
  if (cache) return cache;
  try { cache = sanitizeRecord(JSON.parse(localStorage.getItem(KEY) || "null")); }
  catch { cache = []; }
  return cache;
}

function write(next: PersonalGame[]) {
  if (next === cache) return;
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { /* private mode: the list still works until the page closes */ }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { cache = null; listener(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function usePersonalRecord() {
  const games = useSyncExternalStore(subscribe, read, () => EMPTY_GAMES);
  const remember = useCallback((game: PersonalGame) => write(rememberGame(read(), game)), []);
  const clear = useCallback(() => write([]), []);
  return { games, stats: personalStats(games), remember, clear };
}
