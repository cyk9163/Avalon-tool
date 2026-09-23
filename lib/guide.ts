// Beginner hints (v1.11): one line telling this player what to do now,
// derived only from what this device already sees.
import type { RoomView } from "./game.ts";
import { msg, type Vars } from "./i18n/core.ts";

export type Hint = { text: string; vars?: Vars };

export function guideHint(room: Pick<RoomView, "phase" | "players" | "meId" | "game" | "identity" | "capacity">): Hint | null {
  const me = room.players.find(player => player.id === room.meId);
  const game = room.game;
  if (!me) return room.phase === "lobby" ? { text: msg("选一个和你实际位置对应的座位入座。") } : null;
  if (room.phase === "lobby") return me.ready ? { text: msg("等其他人准备好，房主会统一发身份。") } : { text: msg("确认座位和实际位置一致后，点「我准备好了」。") };
  if (!game) {
    return me.confirmed
      ? { text: msg("等所有人确认身份后，房主开始对局。") }
      : { text: msg("按住身份卡查看你的角色和线索，别让旁边的人看到；记住后点「我记住了」。") };
  }
  switch (room.phase) {
    case "team": {
      const speech = game.speech;
      if (speech && speech.index < speech.order.length && speech.order[speech.index] === me.seat) return { text: msg("轮到你发言：说说你怀疑谁、想让谁上车，说完点「我说完了」。") };
      if (game.leaderSeat === me.seat) return { text: msg("你是队长：先在圆桌上点选 {n} 人并「亮车」，听大家发言后可以改车，最后「发起表决」。"), vars: { n: game.teamSize } };
      return game.draftTeam.length
        ? { text: msg("队长亮车了：想想这些人里有没有坏人，轮到你时说出你的看法。") }
        : { text: msg("听大家发言，等队长亮车。") };
    }
    case "vote":
      return game.myTeamVote === null
        ? { text: msg("投票：信任这支队伍就点赞成。过半赞成才出发，平票算否决。") }
        : { text: msg("等其他人投完，所有人的票会同时公开。") };
    case "quest":
      if (!game.team.includes(me.seat)) return { text: msg("等车上的人秘密出牌，最后只公布失败牌的张数。") };
      return game.myQuestVote === null
        ? { text: msg("你在车上：点「私密提交任务票」。好人只能出成功，坏人可以出失败。") }
        : { text: msg("你的任务牌已密封，等其他队员。") };
    case "lake":
      return game.lake?.holderSeat === me.seat
        ? { text: msg("你拿着湖中仙女：选一位玩家，只有你能看到他的阵营。") }
        : { text: msg("湖中仙女持有者正在查验，稍等片刻。") };
    case "assassination":
      return room.identity?.role === "assassin"
        ? { text: msg("你是刺客：和邪恶同伴商量，选出你认为是梅林的人。") }
        : room.identity?.side === "evil"
          ? { text: msg("帮刺客回忆：谁一直在暗中指路？") }
          : { text: msg("坏人正在找梅林：别让梅林暴露。") };
    case "finished":
      return { text: msg("身份已揭晓：一起看看对局记录，聊聊这局的关键车。") };
    default:
      return null;
  }
}
