// Titles and rank badges. A one-off moment is a title. A running count
// climbs a ladder: more games, or a higher rate, unlocks a higher mark.
import { ROLES, type Role } from "./game/model.ts";

export type RankMark = "bronze" | "silver" | "gold" | "legend";

export type Achievement = { id: string; name: string; hint: string; mark?: RankMark };

type Vote = { seat: number; approve: boolean };
type Proposal = { team: number[]; votes: Vote[]; quest?: number; attempt?: number; leaderSeat?: number; approved?: boolean };
type Quest = { team: number[]; success: boolean; quest?: number; failCount?: number };
type Card = { quest: number; card: "success" | "fail"; success: boolean; failCount: number };

export type CareerGame = { role: string; side: string; winner: string; mvp: number; fact?: string | null };

const MARKS: RankMark[] = ["bronze", "silver", "gold", "legend"];

/** Older count titles. Still wearable if already unlocked. */
const LEGACY: Achievement[] = [
  { id: "first-table", name: "初出茅庐", hint: "完成第一局。" },
  { id: "regular", name: "小有名气", hint: "打满 5 局。" },
  { id: "resident", name: "牌桌常客", hint: "打满 10 局。" },
  { id: "mvp-once", name: "阵营门面", hint: "获得过一次 MVP。" },
  { id: "mvp-thrice", name: "三度封王", hint: "获得过三次 MVP。" },
  { id: "stab-morgana", name: "专刺莫甘娜", hint: "作为刺客，把刀给了莫甘娜。" },
  { id: "stab-mordred", name: "刀给了莫德雷德", hint: "作为刺客，把刀给了莫德雷德。" },
  { id: "stab-ally", name: "刀口向内", hint: "作为刺客，刺中了其他邪恶同伴。" },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "merlin-lives", name: "梅林未死", hint: "作为梅林赢得对局。" },
  { id: "blade-fell", name: "一刀封喉", hint: "作为刺客找到梅林。" },
  { id: "impatient-blade", name: "提前收刀", hint: "提前出刀，并且刺中梅林。" },
  { id: "blade-missed", name: "空刀一场", hint: "作为刺客没有找到梅林。" },
  { id: "saboteur", name: "红牌专家", hint: "作为坏人，上了所有失败的任务。" },
  { id: "scapegoat", name: "背锅侠", hint: "作为好人，上过失败的任务。" },
  { id: "clean-hands", name: "片叶不沾", hint: "作为好人，没有上过失败的任务。" },
  { id: "yes-man", name: "逢车就上", hint: "至少三次组队表决，全部赞成。" },
  { id: "no-man", name: "逢车就拒", hint: "至少三次组队表决，全部反对。" },
  { id: "rejected-own-car", name: "自砸其车", hint: "人在车上，却投了反对。" },
  { id: "fifth-rejection", name: "五票封盘", hint: "坏人因连续五次否决获胜，而你在邪恶阵营。" },
  { id: "percival-instinct", name: "眼跟对了", hint: "作为派西维尔，你赞成的队伍里都有梅林。" },
  { id: "lone-wolf", name: "孤狼称王", hint: "作为奥伯伦获胜。" },
  { id: "both-sides", name: "左右逢源", hint: "正义和邪恶都赢过。" },
  { id: "many-faces", name: "千面牌手", hint: "玩过至少四种角色。" },
  { id: "stab-percival", name: "刀口派西", hint: "作为刺客，刺中了派西维尔。" },
  { id: "stab-loyal", name: "替梅挡刀", hint: "作为刺客，刺中了没有特殊身份的好人。" },
  { id: "stab-oberon", name: "盲狼挨刀", hint: "作为刺客，刺中了看不见的奥伯伦。" },
  { id: "percival-drove", name: "派西带队", hint: "这一局至少上了两车。" },
  { id: "percival-drove-two", name: "连上三车", hint: "这一局至少上了三车。" },
  { id: "percival-regular", name: "带队熟手", hint: "至少打满 3 局派西维尔，其中 2 局上了至少两车。" },
  { id: "percival-three", name: "三车老手", hint: "至少打满 5 局派西维尔，其中 2 局上了至少三车。" },
  { id: "morgana-drove", name: "悍跳开车", hint: "作为莫甘娜，你带的车做成了任务。" },
  { id: "morgana-stole", name: "拐走派西", hint: "作为莫甘娜，派西维尔赞成了有你、没有梅林的队伍。" },
  { id: "morgana-regular", name: "节奏大师", hint: "作为莫甘娜，至少三局带成过车，或带走过派西维尔。" },
  { id: "mordred-hidden", name: "坏票再藏", hint: "出过失败牌，之后又上了成功的任务。" },
  { id: "mordred-regular", name: "再藏老手", hint: "至少两局出过坏票，之后又上了成功的任务。" },
  { id: "loyal-sided", name: "平民之光", hint: "上过一车，且那车上好人比坏人多。" },
  { id: "loyal-regular", name: "铁票忠臣", hint: "至少三局上过好人更多的车。" },
  { id: "loyal-shiver", name: "瑟瑟发抖", hint: "作为好人，上过坏人比好人多的车。" },
  { id: "oberon-sided", name: "盲狼站对", hint: "上过一车，且那车上好人比坏人多。" },
  { id: "oberon-regular", name: "盲狼老手", hint: "至少两局上过好人更多的车。" },
  { id: "wolf-car", name: "一车全狼", hint: "上过一支全是坏人的车。" },
  { id: "deep-cover", name: "深水藏狼", hint: "作为坏人，上过成功的任务。" },
  { id: "unanimous-crash", name: "满票沉船", hint: "你赞成的队伍全票通过，任务却失败了。" },
  { id: "lone-reject", name: "独票否决", hint: "全桌只有你投了反对，队伍被否决。" },
  { id: "merlin-nod", name: "点头翻车", hint: "作为梅林，赞成了一支后来失败的队伍。" },
  { id: "wrong-thigh", name: "抱错金水", hint: "作为派西维尔，赞成了有莫甘娜、没有梅林的队伍。" },
  { id: "sold-teammate", name: "倒钩卖狼", hint: "作为坏人，反对一支有队友、没有你的队伍。" },
  { id: "hammer", name: "锤车在手", hint: "连续两次否决后，由你带队直接执行任务。" },
  { id: "clean-sweep", name: "三蓝清盘", hint: "作为好人，三次任务全部成功并获胜。" },
  { id: "lunatic-card", name: "疯牌必红", hint: "作为疯子，提交了失败牌。" },
  { id: "brute-held", name: "收刀回鞘", hint: "作为野蛮人，第四或第五次任务交出成功牌，并且任务成功。" },
  { id: "solo-fail", name: "一红定局", hint: "任务失败，失败牌只有你这一张。" },
  { id: "lake-merlin", name: "湖中见梅", hint: "用湖中仙女查到了梅林。" },
  { id: "lake-assassin", name: "湖中见刺", hint: "用湖中仙女查到了刺客。" },
  { id: "revealed", name: "当场揭牌", hint: "作为揭露者，身份被公开。" },
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
      { name: "初出茅庐", hint: "完成 1 局。", met: games => games.length >= 1 },
      { name: "小有名气", hint: "完成 5 局。", met: games => games.length >= 5 },
      { name: "名震牌桌", hint: "完成 15 局。", met: games => games.length >= 15 },
      { name: "圆桌神话", hint: "完成 30 局。", met: games => games.length >= 30 },
    ]),
  },
  {
    id: "blade",
    name: "刺客刀法",
    statKey: "出刀 {n} 次，刺中 {p}%",
    stat: games => ({ n: stabs(games).length, p: percent(hits(games), stabs(games).length) }),
    tiers: tiers("blade", [
      { name: "初试刀锋", hint: "出刀至少 2 次，刺中不少于一半。", met: blade(2, 50) },
      { name: "刀刀见血", hint: "出刀至少 4 次，刺中不少于六成。", met: blade(4, 60) },
      { name: "刀无虚发", hint: "出刀至少 6 次，刺中不少于四分之三。", met: blade(6, 75) },
      { name: "取梅首级", hint: "出刀至少 8 次，刺中不少于八成五。", met: blade(8, 85) },
    ]),
  },
  {
    id: "merlin-rank",
    name: "梅林活命",
    statKey: "遇刺 {n} 次，活过 {p}%",
    stat: games => ({ n: knives(games).length, p: percent(lived(games), knives(games).length) }),
    tiers: tiers("merlin-rank", [
      { name: "大难不死", hint: "面对刺杀至少 2 次，活过不少于一半。", met: merlin(2, 50) },
      { name: "金蝉脱壳", hint: "面对刺杀至少 4 次，活过不少于六成。", met: merlin(4, 60) },
      { name: "先知未陨", hint: "面对刺杀至少 6 次，活过不少于四分之三。", met: merlin(6, 75) },
      { name: "百毒不侵", hint: "面对刺杀至少 8 次，活过不少于八成五。", met: merlin(8, 85) },
    ]),
  },
  {
    id: "win-rank",
    name: "胜率段位",
    statKey: "打了 {n} 局，胜率 {p}%",
    stat: games => ({ n: games.length, p: percent(wins(games), games.length) }),
    tiers: tiers("win-rank", [
      { name: "站稳脚跟", hint: "至少 5 局，胜率不少于四成。", met: winRate(5, 40) },
      { name: "连战连捷", hint: "至少 10 局，胜率不少于五成五。", met: winRate(10, 55) },
      { name: "常胜将军", hint: "至少 20 局，胜率不少于六成五。", met: winRate(20, 65) },
      { name: "一方诸侯", hint: "至少 30 局，胜率不少于七成。", met: winRate(30, 70) },
    ]),
  },
  {
    id: "mvp-rank",
    name: "MVP 段位",
    statKey: "累计 MVP {n} 次",
    stat: games => ({ n: mvps(games) }),
    tiers: tiers("mvp-rank", [
      { name: "阵营门面", hint: "累计 1 次 MVP。", met: games => mvps(games) >= 1 },
      { name: "三度封王", hint: "累计 3 次 MVP。", met: games => mvps(games) >= 3 },
      { name: "五度封神", hint: "累计 5 次 MVP。", met: games => mvps(games) >= 5 },
      { name: "冠冕之主", hint: "累计 10 次 MVP。", met: games => mvps(games) >= 10 },
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
  result: { winner: "good" | "evil"; reason: string; early?: boolean; targetSeat?: number };
  quests: Quest[];
  proposals: Proposal[];
  merlinSeat?: number;
  seats?: { seat: number; role: Role }[];
  cards?: Card[];
  lakeTargets?: Role[];
  lakeCheckedSeats?: number[];
  revealed?: boolean;
  seesOberon?: boolean;
  sideAt?: (seat: number, quest: number) => "good" | "evil" | null;
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

  const target = input.seats?.find(player => player.seat === input.result.targetSeat)?.role;
  if (input.role === "assassin" && target && target !== "merlin") {
    if (target === "percival") ids.push("stab-percival");
    else if (target === "oberon" && !input.seesOberon) ids.push("stab-oberon");
    else if (target === "loyal" || target === "cleric" || target === "goodLancelot") ids.push("stab-loyal");
  }
  const led = new Set(input.proposals.filter(proposal => proposal.approved && proposal.leaderSeat === input.seat && input.quests.some(quest => quest.quest === proposal.quest && quest.success)).map(proposal => proposal.quest));
  const boarded = new Set(input.quests.filter(quest => quest.team.includes(input.seat) && quest.quest !== undefined).map(quest => quest.quest));
  if (input.role === "percival" && boarded.size >= 2) ids.push("percival-drove");
  if (input.role === "percival" && boarded.size >= 3) ids.push("percival-drove-two");
  if (input.role === "morgana" && led.size >= 1) ids.push("morgana-drove");
  const percivalSeat = input.seats?.find(player => player.role === "percival")?.seat;
  if (input.role === "morgana" && percivalSeat && input.merlinSeat && input.proposals.some(proposal => {
    const vote = proposal.votes.find(item => item.seat === percivalSeat);
    return vote?.approve && proposal.team.includes(input.seat) && !proposal.team.includes(input.merlinSeat!);
  })) ids.push("morgana-stole");
  const failQuests = (input.cards ?? []).filter(card => card.card === "fail").map(card => card.quest);
  if (input.role === "mordred" && input.quests.some(quest => quest.success && quest.team.includes(input.seat) && quest.quest !== undefined && failQuests.some(fail => fail < quest.quest!))) ids.push("mordred-hidden");
  const myQuests = input.quests.filter(quest => quest.team.includes(input.seat));
  const mix = (quest: Quest) => questMix(input, quest);
  if ((input.role === "loyal" || input.role === "oberon") && myQuests.some(quest => { const sides = mix(quest); return sides.good > sides.evil; })) ids.push(input.role === "loyal" ? "loyal-sided" : "oberon-sided");
  if (myQuests.some(quest => {
    const sides = mix(quest);
    const mine = input.sideAt?.(input.seat, quest.quest ?? 0) ?? input.side;
    return mine === "good" && sides.evil > sides.good;
  })) ids.push("loyal-shiver");
  if (input.side === "evil" && myQuests.some(quest => { const sides = mix(quest); return sides.size >= 2 && sides.good === 0 && sides.evil === sides.size; })) ids.push("wolf-car");
  if (input.side === "evil" && input.quests.some(quest => quest.success && quest.team.includes(input.seat))) ids.push("deep-cover");
  const failedQuests = new Set(input.quests.filter(quest => !quest.success).map(quest => quest.quest));
  if (input.proposals.some(proposal => proposal.approved && proposal.votes.length > 1 && proposal.votes.every(vote => vote.approve) && proposal.votes.some(vote => vote.seat === input.seat) && failedQuests.has(proposal.quest))) ids.push("unanimous-crash");
  if (input.proposals.some(proposal => proposal.approved === false && proposal.votes.filter(vote => !vote.approve).length === 1 && proposal.votes.some(vote => vote.seat === input.seat && !vote.approve))) ids.push("lone-reject");
  if (input.role === "merlin" && input.proposals.some(proposal => proposal.approved && proposal.votes.some(vote => vote.seat === input.seat && vote.approve) && failedQuests.has(proposal.quest))) ids.push("merlin-nod");
  const morganaSeat = input.seats?.find(player => player.role === "morgana")?.seat;
  if (input.role === "percival" && input.merlinSeat && morganaSeat) {
    const hugged = input.proposals.some(proposal => {
      const vote = proposal.votes.find(item => item.seat === input.seat);
      return vote?.approve && proposal.team.includes(morganaSeat) && !proposal.team.includes(input.merlinSeat!);
    });
    if (hugged) ids.push("wrong-thigh");
  }
  if (input.side === "evil" && input.role !== "oberon") {
    const allies = (input.seats ?? []).filter(player => player.seat !== input.seat && player.role !== "oberon" && ROLES[player.role].side === "evil").map(player => player.seat);
    if (input.proposals.some(proposal => allies.some(seat => proposal.team.includes(seat)) && !proposal.team.includes(input.seat) && proposal.votes.some(vote => vote.seat === input.seat && !vote.approve))) ids.push("sold-teammate");
  }
  if (input.proposals.some(proposal => proposal.leaderSeat === input.seat && proposal.approved && proposal.votes.length === 0 && (proposal.attempt ?? 0) >= 3)) ids.push("hammer");
  if (input.side === "good" && won && input.quests.filter(quest => quest.success).length >= 3 && failed.length === 0) ids.push("clean-sweep");
  const cards = input.cards ?? [];
  if (input.role === "lunatic" && cards.some(card => card.card === "fail")) ids.push("lunatic-card");
  if (input.role === "brute" && cards.some(card => card.quest >= 4 && card.card === "success" && card.success)) ids.push("brute-held");
  if (cards.some(card => card.card === "fail" && card.failCount === 1 && !card.success)) ids.push("solo-fail");
  if (input.lakeTargets?.includes("merlin")) ids.push("lake-merlin");
  if (input.lakeTargets?.includes("assassin")) ids.push("lake-assassin");
  if (input.revealed && input.role === "revealer") ids.push("revealed");
  return ids;
}

function questMix(input: { seats?: { seat: number; role: Role }[]; sideAt?: (seat: number, quest: number) => "good" | "evil" | null }, quest: Quest): { good: number; evil: number; size: number } {
  let good = 0;
  let evil = 0;
  for (const seat of quest.team) {
    const role = input.seats?.find(player => player.seat === seat)?.role;
    const side = input.sideAt?.(seat, quest.quest ?? 0) ?? (role ? ROLES[role].side : null);
    if (side === "good") good += 1;
    else if (side === "evil") evil += 1;
  }
  return { good, evil, size: quest.team.length };
}

/** Fact stored on the game row. Knife results stay; other roles store the moment used for career titles. */
export function recordFact(input: Parameters<typeof gameAchievementIds>[0]): string | null {
  const knife = gameFact(input.role, input.result);
  if (knife) return knife;
  const ids = gameAchievementIds(input);
  if (ids.includes("percival-drove-two")) return "b3";
  if (ids.includes("percival-drove")) return "b2";
  if (ids.includes("morgana-drove") || ids.includes("morgana-stole")) return "paced";
  if (ids.includes("mordred-hidden")) return "hidden";
  if (ids.includes("loyal-sided") || ids.includes("oberon-sided")) return "sided";
  return null;
}

/** Rank badges and career titles across every stored game. */
export function careerAchievementIds(games: CareerGame[]): string[] {
  const ids = RANK_TRACKS.flatMap(track => track.tiers.filter(tier => tier.met(games)).map(tier => tier.id));
  if (games.some(game => game.side === "good" && game.side === game.winner) && games.some(game => game.side === "evil" && game.side === game.winner)) ids.push("both-sides");
  if (new Set(games.map(game => game.role)).size >= 4) ids.push("many-faces");
  const count = (role: string, fact: string) => games.filter(game => game.role === role && game.fact === fact).length;
  const percivalGames = games.filter(game => game.role === "percival");
  const twoCars = percivalGames.filter(game => game.fact === "b2" || game.fact === "b3").length;
  const threeCars = percivalGames.filter(game => game.fact === "b3").length;
  if (percivalGames.length >= 3 && twoCars >= 2) ids.push("percival-regular");
  if (percivalGames.length >= 5 && threeCars >= 2) ids.push("percival-three");
  if (count("morgana", "paced") >= 3) ids.push("morgana-regular");
  if (count("mordred", "hidden") >= 2) ids.push("mordred-regular");
  if (count("loyal", "sided") >= 3) ids.push("loyal-regular");
  if (count("oberon", "sided") >= 2) ids.push("oberon-regular");
  return ids;
}
