// What each role sees, who sees it and which quest cards it may play (v1.9),
// under this site's fixed rules (evil allies know each other's exact roles,
// Oberon excepted; Merlin sees evil except Mordred). Mirrors identityFor()
// and allowedQuestCards() in lib/game.ts; tests keep them in step.
import type { Role } from "./game.ts";
import { msg } from "./i18n/core.ts";

export type RoleInfo = { sees: string; seenBy: string; cards: string };

const NOBODY = msg("没有人");
const SUCCESS_ONLY = msg("只能出成功");
const EITHER = msg("成功或失败都可以");
const EVIL_ALLIES = msg("除奥伯伦外的邪恶同伴，并知道他们的具体角色");
const SEEN_BY_EVIL = msg("除奥伯伦外的邪恶同伴；梅林也能看出你是邪恶");

export const ROLE_INFO: Record<Role, RoleInfo> = {
  merlin: { sees: msg("除莫德雷德外的所有邪恶玩家（不知道具体角色）"), seenBy: msg("派西维尔（和莫甘娜混在一起）；刺客要在最后找出你"), cards: SUCCESS_ONLY },
  percival: { sees: msg("梅林和莫甘娜，但分不清谁是谁"), seenBy: NOBODY, cards: SUCCESS_ONLY },
  loyal: { sees: NOBODY, seenBy: NOBODY, cards: SUCCESS_ONLY },
  goodLancelot: { sees: NOBODY, seenBy: NOBODY, cards: msg("属于正义时只能出成功；忠诚牌转换后只能出失败") },
  cleric: { sees: msg("第一任队长属于正义还是邪恶（不知道具体角色）"), seenBy: NOBODY, cards: SUCCESS_ONLY },
  assassin: { sees: EVIL_ALLIES, seenBy: SEEN_BY_EVIL, cards: EITHER },
  morgana: { sees: EVIL_ALLIES, seenBy: msg("除奥伯伦外的邪恶同伴；梅林能看出你是邪恶；派西维尔会把你当成梅林候选"), cards: EITHER },
  mordred: { sees: EVIL_ALLIES, seenBy: msg("除奥伯伦外的邪恶同伴；梅林看不到你"), cards: EITHER },
  oberon: { sees: NOBODY, seenBy: msg("只有梅林能看出你是邪恶；邪恶同伴不认识你"), cards: EITHER },
  evilLancelot: { sees: EVIL_ALLIES, seenBy: SEEN_BY_EVIL, cards: msg("属于邪恶时只能出失败；忠诚牌转换后只能出成功") },
  lunatic: { sees: EVIL_ALLIES, seenBy: SEEN_BY_EVIL, cards: msg("只要参加任务就必须出失败") },
  brute: { sees: EVIL_ALLIES, seenBy: SEEN_BY_EVIL, cards: msg("前三次任务成功或失败都可以；第四、第五次只能出成功") },
  revealer: { sees: EVIL_ALLIES, seenBy: msg("除奥伯伦外的邪恶同伴；梅林能看出你是邪恶；第二次任务失败后向所有人公开"), cards: EITHER },
  minion: { sees: EVIL_ALLIES, seenBy: SEEN_BY_EVIL, cards: EITHER },
};
