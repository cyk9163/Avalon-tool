// Titles and rank badges. A one-off moment is a title. A running count
// climbs a ladder: more games, or a higher rate, unlocks a higher mark.
import type { Role } from "./game.ts";

export type RankMark = "bronze" | "silver" | "gold" | "legend";

export type Achievement = { id: string; name: string; hint: string; mark?: RankMark };

type Vote = { seat: number; approve: boolean };
type Proposal = { team: number[]; votes: Vote[] };
type Quest = { team: number[]; success: boolean };

export type CareerGame = { role: string; side: string; winner: string; mvp: number; fact?: string | null };

const MARKS: RankMark[] = ["bronze", "silver", "gold", "legend"];

/** Older count titles. Still wearable if already unlocked. */
const LEGACY: Achievement[] = [
  { id: "first-table", name: "初入圆桌", hint: "完成第一局。" },
  { id: "regular", name: "圆桌常客", hint: "打满 5 局。" },
  { id: "resident", name: "常驻骑士", hint: "打满 10 局。" },
  { id: "mvp-once", name: "本阵营的脸", hint: "获得过一次 MVP。" },
  { id: "mvp-thrice", name: "三度加冕", hint: "获得过三次 MVP。" },
];

export const ACHIEVEMENTS: Achievement[] = [
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
  { id: "both-sides", name: "两面派", hint: "正义和邪恶都赢过。" },
  { id: "many-faces", name: "百变圆桌", hint: "玩过至少四种角色。" },
];

type Tier = { id: string; name: string; hint: string; mark: RankMark; met: (games: CareerGame[]) => boolean };
type Track = {
  id: string;
  name: string;
  statKey: string;
  stat: (games: CareerGame[]) => Record<string, string | number>;
  tiers: Tier[];
};

const percent = (hit: number, total: number) => total ? Math.round(hit / total * 100) : 0;
const enough = (total: number, hit: number, needTotal: number, needPercent: number) => total >= needTotal && percent(hit, total) >= needPercent;

const stabs = (games: CareerGame[]) => games.filter(game => game.role === "assassin" && (game.fact === "hit" || game.fact === "miss"));
const hits = (games: CareerGame[]) => stabs(games).filter(game => game.fact === "hit").length;
const knives = (games: CareerGame[]) => games.filter(game => game.role === "merlin" && (game.fact === "lived" || game.fact === "died"));
const lived = (games: CareerGame[]) => knives(games).filter(game => game.fact === "lived").length;
const mvps = (games: CareerGame[]) => games.filter(game => game.mvp).length;
const wins = (games: CareerGame[]) => games.filter(game => game.side === game.winner).length;

const blade = (needTotal: number, needPercent: number) => (games: CareerGame[]) => enough(stabs(games).length, hits(games), needTotal, needPercent);
const merlin = (needTotal: number, needPercent: number) => (games: CareerGame[]) => enough(knives(games).length, lived(games), needTotal, needPercent);
const winRate = (needTotal: number, needPercent: number) => (games: CareerGame[]) => enough(games.length, wins(games), needTotal, needPercent);

function tiers(prefix: string, rows: { name: string; hint: string; met: (games: CareerGame[]) => boolean }[]): Tier[] {
  return rows.map((row, index) => ({ id: `${prefix}-${index + 1}`, name: row.name, hint: row.hint, mark: MARKS[index] ?? "bronze", met: row.met }));
}

export const RANK_TRACKS: Track[] = [
  {
    id: "tenure",
    name: "圆桌资历",
    statKey: "资历 {n} 局",
    stat: games => ({ n: games.length }),
    tiers: tiers("tenure", [
      { name: "初入圆桌", hint: "完成 1 局。", met: games => games.length >= 1 },
      { name: "圆桌常客", hint: "完成 5 局。", met: games => games.length >= 5 },
      { name: "常驻骑士", hint: "完成 15 局。", met: games => games.length >= 15 },
      { name: "圆桌传说", hint: "完成 30 局。", met: games => games.length >= 30 },
    ]),
  },
  {
    id: "blade",
    name: "刺客刀法",
    statKey: "出刀 {n} 次，刺中 {p}%",
    stat: games => ({ n: stabs(games).length, p: percent(hits(games), stabs(games).length) }),
    tiers: tiers("blade", [
      { name: "见习刀客", hint: "出刀至少 2 次，刺中不少于一半。", met: blade(2, 50) },
      { name: "老练刺客", hint: "出刀至少 4 次，刺中不少于六成。", met: blade(4, 60) },
      { name: "金刀", hint: "出刀至少 6 次，刺中不少于四分之三。", met: blade(6, 75) },
      { name: "梅林克星", hint: "出刀至少 8 次，刺中不少于八成五。", met: blade(8, 85) },
    ]),
  },
  {
    id: "merlin-rank",
    name: "梅林活命",
    statKey: "遇刺 {n} 次，活过 {p}%",
    stat: games => ({ n: knives(games).length, p: percent(lived(games), knives(games).length) }),
    tiers: tiers("merlin-rank", [
      { name: "学徒梅林", hint: "面对刺杀至少 2 次，活过不少于一半。", met: merlin(2, 50) },
      { name: "难缠的梅林", hint: "面对刺杀至少 4 次，活过不少于六成。", met: merlin(4, 60) },
      { name: "大先知", hint: "面对刺杀至少 6 次，活过不少于四分之三。", met: merlin(6, 75) },
      { name: "杀不死", hint: "面对刺杀至少 8 次，活过不少于八成五。", met: merlin(8, 85) },
    ]),
  },
  {
    id: "win-rank",
    name: "胜率段位",
    statKey: "打了 {n} 局，胜率 {p}%",
    stat: games => ({ n: games.length, p: percent(wins(games), games.length) }),
    tiers: tiers("win-rank", [
      { name: "站稳了", hint: "至少 5 局，胜率不少于四成。", met: winRate(5, 40) },
      { name: "胜多负少", hint: "至少 10 局，胜率不少于五成五。", met: winRate(10, 55) },
      { name: "常胜将军", hint: "至少 20 局，胜率不少于六成五。", met: winRate(20, 65) },
      { name: "圆桌主宰", hint: "至少 30 局，胜率不少于七成。", met: winRate(30, 70) },
    ]),
  },
  {
    id: "mvp-rank",
    name: "MVP 段位",
    statKey: "累计 MVP {n} 次",
    stat: games => ({ n: mvps(games) }),
    tiers: tiers("mvp-rank", [
      { name: "本阵营的脸", hint: "累计 1 次 MVP。", met: games => mvps(games) >= 1 },
      { name: "三度加冕", hint: "累计 3 次 MVP。", met: games => mvps(games) >= 3 },
      { name: "五度加冕", hint: "累计 5 次 MVP。", met: games => mvps(games) >= 5 },
      { name: "冠冕常客", hint: "累计 10 次 MVP。", met: games => mvps(games) >= 10 },
    ]),
  },
];

const ALL: Achievement[] = [
  ...ACHIEVEMENTS,
  ...LEGACY,
  ...RANK_TRACKS.flatMap(track => track.tiers.map(tier => ({ id: tier.id, name: tier.name, hint: tier.hint, mark: tier.mark }))),
];

const BY_ID = new Map(ALL.map(item => [item.id, item]));

export function achievementById(id: string): Achievement | undefined {
  return BY_ID.get(id);
}

export function isAchievementId(id: string): boolean {
  return BY_ID.has(id);
}

export type RankTierView = { id: string; name: string; hint: string; mark: RankMark; owned: boolean };
export type RankTrackView = { id: string; name: string; statKey: string; statVars: Record<string, string | number>; tiers: RankTierView[]; nextHint: string | null };

export function rankTracks(games: CareerGame[]): RankTrackView[] {
  return RANK_TRACKS.map(track => {
    const tiersView = track.tiers.map(tier => ({ id: tier.id, name: tier.name, hint: tier.hint, mark: tier.mark, owned: tier.met(games) }));
    return { id: track.id, name: track.name, statKey: track.statKey, statVars: track.stat(games), tiers: tiersView, nextHint: tiersView.find(tier => !tier.owned)?.hint ?? null };
  });
}

/** What this game should remember for later rank checks. Null when the moment was not a knife. */
export function gameFact(role: string, result: { reason: string }): string | null {
  if (role === "assassin" && result.reason === "merlin-assassinated") return "hit";
  if (role === "assassin" && result.reason === "assassin-missed") return "miss";
  if (role === "merlin" && result.reason === "merlin-assassinated") return "died";
  if (role === "merlin" && result.reason === "assassin-missed") return "lived";
  return null;
}

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

/** Rank badges and career titles across every stored game. */
export function careerAchievementIds(games: CareerGame[]): string[] {
  const ids = RANK_TRACKS.flatMap(track => track.tiers.filter(tier => tier.met(games)).map(tier => tier.id));
  if (games.some(game => game.side === "good" && game.side === game.winner) && games.some(game => game.side === "evil" && game.side === game.winner)) ids.push("both-sides");
  if (new Set(games.map(game => game.role)).size >= 4) ids.push("many-faces");
  return ids;
}
