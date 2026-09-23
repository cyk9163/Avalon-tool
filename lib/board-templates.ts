// Custom-board templates (v0.11): a few recommended built-in boards plus the
// host's own boards saved on this device. There are no accounts, so saved
// templates live in localStorage only. Every template is checked against the
// same validation the server applies when the room is created.
import { CUSTOM_EVIL_ROLES, CUSTOM_GOOD_ROLES, EVIL_COUNTS, ROLES, validateCustomRoles, type Role } from "./game.ts";
import { msg } from "./i18n/core.ts";

export type BoardTemplate = { id: string; name: string; hint?: string; specials: Role[]; ladyOfLake: boolean; builtIn?: boolean };

export const MAX_SAVED_TEMPLATES = 8;
export const MAX_TEMPLATE_NAME = 12;
const STORAGE_KEY = "avalon:board-templates";
const CAPACITIES = [5, 6, 7, 8, 9, 10] as const;
const SPECIALS = new Set<Role>([...CUSTOM_GOOD_ROLES, ...CUSTOM_EVIL_ROLES]);

export const BUILT_IN_TEMPLATES: readonly BoardTemplate[] = [
  { id: "mordred-shadow", name: msg("暗影莫德雷德"), hint: msg("梅林看不见莫德雷德"), specials: ["merlin", "percival", "assassin", "mordred"], ladyOfLake: false, builtIn: true },
  { id: "oberon-alone", name: msg("孤狼奥伯伦"), hint: msg("奥伯伦与同伴互不相识"), specials: ["merlin", "percival", "assassin", "oberon"], ladyOfLake: false, builtIn: true },
  { id: "lake-classic", name: msg("湖中仙女经典局"), hint: msg("经典角色，加上湖中仙女查验"), specials: ["merlin", "percival", "assassin", "morgana"], ladyOfLake: true, builtIn: true },
  { id: "lancelot", name: msg("兰斯洛特对决"), hint: msg("两位兰斯洛特彼此认识"), specials: ["merlin", "percival", "goodLancelot", "assassin", "morgana", "evilLancelot"], ladyOfLake: false, builtIn: true },
  { id: "cleric", name: msg("牧师开局"), hint: msg("牧师知道首任队长的阵营"), specials: ["merlin", "percival", "cleric", "assassin", "morgana"], ladyOfLake: false, builtIn: true },
  { id: "revealer", name: msg("迷雾揭露"), hint: msg("莫德雷德藏身，揭露者会现身"), specials: ["merlin", "percival", "assassin", "mordred", "revealer"], ladyOfLake: false, builtIn: true },
  { id: "wild", name: msg("失控的邪恶"), hint: msg("疯子必出失败，野蛮人后期收手"), specials: ["merlin", "percival", "assassin", "lunatic", "brute"], ladyOfLake: false, builtIn: true },
];

/** The full role list for a capacity: chosen specials, padded with loyal servants and minions. */
export function fillCustomRoles(capacity: number, specials: Iterable<Role>): Role[] {
  const chosen = [...specials];
  const good = chosen.filter(role => ROLES[role].side === "good"), evil = chosen.filter(role => ROLES[role].side === "evil");
  const goodSlots = capacity - EVIL_COUNTS[capacity], evilSlots = EVIL_COUNTS[capacity];
  return [...good, ...Array(Math.max(0, goodSlots - good.length)).fill("loyal"), ...evil, ...Array(Math.max(0, evilSlots - evil.length)).fill("minion")] as Role[];
}

/** Whether the template can be played at this capacity, using the server's own rules. */
export function templateFits(template: Pick<BoardTemplate, "specials" | "ladyOfLake">, capacity: number): boolean {
  if (template.ladyOfLake && capacity < 7) return false;
  const good = template.specials.filter(role => ROLES[role].side === "good").length;
  const evil = template.specials.length - good;
  if (good > capacity - EVIL_COUNTS[capacity] || evil > EVIL_COUNTS[capacity]) return false;
  try {
    validateCustomRoles(capacity, fillCustomRoles(capacity, template.specials));
    return true;
  } catch {
    return false;
  }
}

/** Smallest player count the template supports, or null if none. */
export function templateMinimum(template: Pick<BoardTemplate, "specials" | "ladyOfLake">): number | null {
  return CAPACITIES.find(capacity => templateFits(template, capacity)) ?? null;
}

export function sameBoard(template: Pick<BoardTemplate, "specials" | "ladyOfLake">, specials: ReadonlySet<Role>, ladyOfLake: boolean): boolean {
  return template.ladyOfLake === ladyOfLake && template.specials.length === specials.size && template.specials.every(role => specials.has(role));
}

/** Drops anything malformed a stored template could contain. */
export function sanitizeTemplates(value: unknown): BoardTemplate[] {
  if (!Array.isArray(value)) return [];
  const result: BoardTemplate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, name, specials, ladyOfLake } = item as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id) || typeof name !== "string" || !Array.isArray(specials)) continue;
    const roles = [...new Set(specials.filter((role): role is Role => typeof role === "string" && SPECIALS.has(role as Role)))];
    const template = { id, name: name.trim().slice(0, MAX_TEMPLATE_NAME), specials: roles, ladyOfLake: ladyOfLake === true };
    if (!template.name || !roles.includes("merlin") || !roles.includes("assassin") || templateMinimum(template) === null) continue;
    result.push(template);
    if (result.length === MAX_SAVED_TEMPLATES) break;
  }
  return result;
}

export function loadSavedTemplates(): BoardTemplate[] {
  try { return sanitizeTemplates(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { return []; }
}

export function storeSavedTemplates(templates: BoardTemplate[]): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.map(({ id, name, specials, ladyOfLake }) => ({ id, name, specials, ladyOfLake })))); return true; } catch { return false; }
}

export function newTemplateId(): string {
  return `t-${crypto.randomUUID().slice(0, 8)}`;
}
