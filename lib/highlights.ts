// End-of-game highlights (v1.12). At most four lines, chosen only from what a
// member can already see: public votes, quest results and revealed roles.
// Each line is a msg() key so the English dictionary can translate it.
import { ROLES, type GameView, type Role } from "./game.ts";
import { msg } from "./i18n/core.ts";

export type Highlight = { key: string; vars: Record<string, string | number> };
export type RevealedRole = { seat: number; role: Role };

const VILLAINS = msg("坏人 {players} 上了所有失败的任务。");
const MERLIN = msg("梅林 {n} 次反对里，有 {m} 次反对的是后来失败的任务。");
const PERCIVAL = msg("派西维尔从第 {k} 次组队起，只赞成有梅林的队伍。");
const ASSASSIN_HIT = msg("刺客锁定了梅林。");
const ASSASSIN_EARLY = msg("刺客提前出刀就锁定了梅林。");
const ASSASSIN_MISS = msg("刺客没有找到梅林。");
const REJECTIONS = msg("连续否决最多出现在任务 {quest}：连续 {n} 次。");

const MAX_HIGHLIGHTS = 4;

/** Final side, including Lancelot swaps that the table already saw. */
export function finalSide(role: Role, switched: boolean): "good" | "evil" {
  if ((role === "goodLancelot" || role === "evilLancelot") && switched) {
    return ROLES[role].side === "good" ? "evil" : "good";
  }
  return ROLES[role].side;
}

/**
 * Up to four highlights. `name` renders one seat; `sep` joins several
 * (the caller's language chooses the separator). Returns [] when nothing
 * notable happened, or when roles were not revealed to this viewer.
 */
export function gameHighlights(
  game: GameView | null | undefined,
  revealedRoles: RevealedRole[] | null,
  name: (seat: number) => string,
  sep: string,
): Highlight[] {
  if (!game?.result || !revealedRoles?.length) return [];
  const sideOf = (seat: number) => {
    const role = revealedRoles.find(player => player.seat === seat)?.role;
    return role ? finalSide(role, game.lancelotsSwitched) : null;
  };
  const items: Highlight[] = [];

  const failed = game.quests.filter(quest => !quest.success);
  if (failed.length) {
    const villains = revealedRoles.filter(player => sideOf(player.seat) === "evil" && failed.every(quest => quest.team.includes(player.seat)));
    if (villains.length) items.push({ key: VILLAINS, vars: { players: villains.map(player => name(player.seat)).join(sep) } });
  }

  const merlin = revealedRoles.find(player => player.role === "merlin");
  if (merlin) {
    const rejects = game.proposals.filter(proposal => proposal.votes.some(vote => vote.seat === merlin.seat && !vote.approve));
    const badRejects = rejects.filter(proposal => proposal.approved && game.quests.some(quest => quest.quest === proposal.quest && !quest.success));
    if (rejects.length > 0 && badRejects.length > 0) items.push({ key: MERLIN, vars: { n: rejects.length, m: badRejects.length } });
  }

  const percival = revealedRoles.find(player => player.role === "percival");
  if (percival && merlin && game.proposals.length >= 2) {
    const aligned = (proposal: GameView["proposals"][number]) => {
      const vote = proposal.votes.find(item => item.seat === percival.seat);
      if (!vote) return false;
      return vote.approve === proposal.team.includes(merlin.seat);
    };
    let start = -1;
    for (let index = 0; index < game.proposals.length; index++) {
      const rest = game.proposals.slice(index);
      if (rest.length >= 2 && rest.every(aligned) && rest.some(proposal => proposal.team.includes(merlin.seat))) {
        start = index;
        break;
      }
    }
    if (start >= 0) items.push({ key: PERCIVAL, vars: { k: start + 1 } });
  }

  if (game.result.reason === "merlin-assassinated") items.push({ key: game.result.early ? ASSASSIN_EARLY : ASSASSIN_HIT, vars: {} });
  else if (game.result.reason === "assassin-missed") items.push({ key: ASSASSIN_MISS, vars: {} });

  let best = 0;
  let bestQuest = 0;
  let run = 0;
  let runQuest = 0;
  for (const proposal of game.proposals) {
    if (!proposal.approved) {
      run += 1;
      runQuest = proposal.quest;
      if (run > best) { best = run; bestQuest = runQuest; }
    } else run = 0;
  }
  if (best >= 3) items.push({ key: REJECTIONS, vars: { quest: bestQuest, n: best } });

  return items.slice(0, MAX_HIGHLIGHTS);
}
