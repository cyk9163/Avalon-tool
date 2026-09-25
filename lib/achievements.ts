// Titles earned from Avalon moments. A player can hang one on their profile.
import type { Role } from "./game.ts";

export type Achievement = { id: string; name: string; hint: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-table", name: "初入圆桌", hint: "完成第一局。" },
  { id: "regular", name: "圆桌常客", hint: "打满 5 局。" },
  { id: "resident", name: "常驻骑士", hint: "打满 10 局。" },
  { id: "merlin-lives", name: "还活着的梅林", hint: "作为梅林赢得对局。" },
  { id: "blade-fell", name: "刀已落下", hint: "作为刺客找到梅林。" },
  { id: "impatient-blade", name: "等不及了", hint: "提前出刀，并且刺中梅林。" },
  { id: "blade-missed", name: "刺偏了", hint: "作为刺客没有找到梅林。" },
  { id: "saboteur", name: "破坏专家", hint: "作为坏人，上了所有失败的任务。" },
  { id: "scapegoat", name: "背锅侠", hint: "作为好人，上过失败的任务。" },
  { id: "clean-hands", name: "一身清白", hint: "作为好人，没有上过失败的任务。" },
  { id: "yes-man", name: "谁都赞成", hint: "至少三次组队表决，全部赞成。" },
  { id: "no-man", name: "一张赞成没有", hint: "至少三次组队表决，全部反对。" },
  { id: "rejected-own-car", name: "自己的车也反对", hint: "人在车上，却投了反对。" },
  { id: "fifth-rejection", name: "五连否决", hint: "坏人因连续五次否决获胜，而你在邪恶阵营。" },
  { id: "percival-instinct", name: "跟对人了", hint: "作为派西维尔，你赞成的队伍里都有梅林。" },
  { id: "lone-wolf", name: "孤狼也赢了", hint: "作为奥伯伦获胜。" },
  { id: "mvp-once", name: "本阵营的脸", hint: "获得过一次 MVP。" },
  { id: "mvp-thrice", name: "三度加冕", hint: "获得过三次 MVP。" },
  { id: "both-sides", name: "两面派", hint: "正义和邪恶都赢过。" },
  { id: "many-faces", name: "百变圆桌", hint: "玩过至少四种角色。" },
];

const KNOWN = new Set(ACHIEVEMENTS.map(item => item.id));

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(item => item.id === id);
}

export function isAchievementId(id: string): boolean {
  return KNOWN.has(id);
}

type Vote = { seat: number; approve: boolean };
type Proposal = { team: number[]; votes: Vote[] };
type Quest = { team: number[]; success: boolean };

/** Moments from a single finished game, for the player who just played it. */
export function gameAchievementIds(input: {
  role: Role;
  seat: number;
  side: "good" | "evil";
  result: { winner: "good" | "evil"; reason: string; early?: boolean };
  quests: Quest[];
  proposals: Proposal[];
  merlinSeat?: number;
}): string[] {
  const ids: string[] = [];
  const won = input.side === input.result.winner;
  if (input.role === "merlin" && won) ids.push("merlin-lives");
  if (input.role === "assassin" && input.result.reason === "merlin-assassinated") ids.push(input.result.early ? "impatient-blade" : "blade-fell");
  if (input.role === "assassin" && input.result.reason === "assassin-missed") ids.push("blade-missed");
  if (input.role === "oberon" && won) ids.push("lone-wolf");
  const failed = input.quests.filter(quest => !quest.success);
  if (input.side === "evil" && failed.length > 0 && failed.every(quest => quest.team.includes(input.seat))) ids.push("saboteur");
  if (input.side === "good" && failed.some(quest => quest.team.includes(input.seat))) ids.push("scapegoat");
  if (input.side === "good" && input.quests.length > 0 && failed.every(quest => !quest.team.includes(input.seat))) ids.push("clean-hands");
  const mine = input.proposals.map(proposal => proposal.votes.find(vote => vote.seat === input.seat)).filter((vote): vote is Vote => !!vote);
  if (mine.length >= 3 && mine.every(vote => vote.approve)) ids.push("yes-man");
  if (mine.length >= 3 && mine.every(vote => !vote.approve)) ids.push("no-man");
  if (input.proposals.some(proposal => proposal.team.includes(input.seat) && proposal.votes.some(vote => vote.seat === input.seat && !vote.approve))) ids.push("rejected-own-car");
  if (input.side === "evil" && input.result.reason === "five-rejections") ids.push("fifth-rejection");
  if (input.role === "percival" && input.merlinSeat && input.proposals.length >= 2) {
    const aligned = input.proposals.every(proposal => {
      const vote = proposal.votes.find(item => item.seat === input.seat);
      if (!vote) return true;
      return vote.approve === proposal.team.includes(input.merlinSeat!);
    });
    if (aligned && input.proposals.some(proposal => proposal.team.includes(input.merlinSeat!))) ids.push("percival-instinct");
  }
  return ids;
}

/** Milestones across every stored game, including the one just finished. */
export function careerAchievementIds(games: { role: string; side: string; winner: string; mvp: number }[]): string[] {
  const ids: string[] = [];
  if (games.length >= 1) ids.push("first-table");
  if (games.length >= 5) ids.push("regular");
  if (games.length >= 10) ids.push("resident");
  const mvps = games.filter(game => game.mvp).length;
  if (mvps >= 1) ids.push("mvp-once");
  if (mvps >= 3) ids.push("mvp-thrice");
  const wonGood = games.some(game => game.side === "good" && game.side === game.winner);
  const wonEvil = games.some(game => game.side === "evil" && game.side === game.winner);
  if (wonGood && wonEvil) ids.push("both-sides");
  if (new Set(games.map(game => game.role)).size >= 4) ids.push("many-faces");
  return ids;
}
