// "Is it my move?" (v1.8): derived only from what this device already sees,
// used for the tab title, vibration, the home-screen badge and the nav dot.
import type { RoomView } from "./game.ts";
import { msg } from "./i18n/core.ts";

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
