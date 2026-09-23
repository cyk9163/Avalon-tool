// "Is it my move?" (v1.8): derived only from what this device already sees,
// used for the tab title, vibration, the home-screen badge and the nav dot.
// seatTurn uses the same rules on the full room, so a lock-screen push can
// name who newly has a turn without inventing a second definition.
import type { Room, RoomView } from "./game.ts";
import { speakingOrder } from "./game.ts";
import { msg, translate, type Lang } from "./i18n/core.ts";

export function myTurn(room: Pick<RoomView, "phase" | "players" | "meId" | "game" | "identity">): string | null {
  const me = room.players.find(player => player.id === room.meId);
  const game = room.game;
  if (!me || !game) return null;
  if (room.phase === "team") {
    const speech = game.speech;
    if (speech && speech.index < speech.order.length && speech.order[speech.index] === me.seat) return msg("轮到你发言");
    if (game.leaderSeat === me.seat) return msg("轮到你选队");
    return null;
  }
  if (room.phase === "vote") return game.myTeamVote === null ? msg("轮到你投票") : null;
  if (room.phase === "quest") return game.team.includes(me.seat) && game.myQuestVote === null ? msg("轮到你出任务牌") : null;
  if (room.phase === "lake") return game.lake?.holderSeat === me.seat ? msg("轮到你使用湖中仙女") : null;
  if (room.phase === "assassination") return room.identity?.role === "assassin" ? msg("轮到你刺杀") : null;
  return null;
}

/** The same labels as myTurn, read from the server's full room instead of one player's projection. */
export function seatTurn(room: Pick<Room, "phase" | "capacity" | "players" | "game">, playerId: string): string | null {
  const player = room.players.find(item => item.id === playerId);
  const game = room.game;
  if (!player || !game) return null;
  if (room.phase === "team") {
    if (game.speech?.turnId === game.turnId) {
      const order = speakingOrder(room, game.leaderSeat);
      if (game.speech.index < order.length && order[game.speech.index] === player.seat) return msg("轮到你发言");
    }
    if (game.leaderSeat === player.seat) return msg("轮到你选队");
    return null;
  }
  if (room.phase === "vote") return game.teamVotes[player.seat] === undefined ? msg("轮到你投票") : null;
  if (room.phase === "quest") return game.team.includes(player.seat) && game.questVotes[player.seat] === undefined ? msg("轮到你出任务牌") : null;
  if (room.phase === "lake") return game.lake?.holderSeat === player.seat ? msg("轮到你使用湖中仙女") : null;
  if (room.phase === "assassination") return player.role === "assassin" ? msg("轮到你刺杀") : null;
  return null;
}

export function turnMap(room: Pick<Room, "phase" | "capacity" | "players" | "game">): Map<string, string> {
  const turns = new Map<string, string>();
  for (const player of room.players) {
    const label = seatTurn(room, player.id);
    if (label) turns.set(player.id, label);
  }
  return turns;
}

/** Players whose prompt appeared or changed. Someone still on the same prompt is not notified again. */
export function newlyOnTurn(before: Map<string, string>, after: Map<string, string>): { id: string; label: string }[] {
  const fresh: { id: string; label: string }[] = [];
  for (const [id, label] of after) if (before.get(id) !== label) fresh.push({ id, label });
  return fresh;
}

const PUSH_NOTICE = msg("{label} · 房间 {code}");

/** Lock-screen text. The label is one of the turn prompts; the room code is how the player gets back. No names or roles. */
export function pushNotice(label: string, code: string, lang: Lang = "zh"): string {
  return translate(lang, PUSH_NOTICE, { label: translate(lang, label), code });
}
