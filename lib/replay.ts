// Plain-text replay of a finished game (v0.11), for copying into a chat or
// saving as a file. Built only from the viewer's own RoomView, which never
// contains quest cards per player, so the export cannot reveal who played a
// fail card. Private lake-of-the-lake results are left out as well.
// v1.0: written in the viewer's interface language (Chinese by default).
import { PRESETS, ROLES, type RoomView } from "./game.ts";
import { seatStats } from "./seat-stats.ts";
import { msg, translate, type Lang, type Vars } from "./i18n/core.ts";

const REASONS = {
  "three-failures": msg("三次任务失败"),
  "five-rejections": msg("连续五次组队被否决"),
  "merlin-assassinated": msg("刺客找到了梅林"),
  "assassin-missed": msg("刺客没有找到梅林"),
} as const;

function pad(value: number) { return String(value).padStart(2, "0"); }

export function replayDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function replayFileName(room: Pick<RoomView, "round">, date: Date): string {
  return `avalon-replay-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}-r${room.round}.txt`;
}

/** Returns null until the game has a result. */
export function replayText(room: RoomView, date = new Date(), lang: Lang = "zh"): string | null {
  const game = room.game;
  if (!game?.result) return null;
  const t = (zh: string, vars?: Vars) => translate(lang, zh, vars);
  const name = (seat: number) => {
    const player = room.players.find(item => item.seat === seat);
    return player?.name ? t("{seat} 号 {name}", { seat, name: player.name }) : t("{seat} 号", { seat });
  };
  const seats = (list: number[]) => list.length ? t("{seats} 号", { seats: list.map(seat => lang === "en" ? `#${seat}` : `${seat}`).join(t("、")) }) : t("无");
  const lines: string[] = [];
  const preset = t(PRESETS[room.preset].name);
  const board = room.ladyOfLake ? t("{board} + 湖中仙女", { board: preset }) : preset;
  lines.push(t("圆桌 · 阿瓦隆复盘"));
  lines.push(t("{date} · 第 {round} 局 · {count} 人 · {board}", { date: replayDate(date), round: room.round, count: room.capacity, board }));
  const counts = new Map<string, number>();
  for (const role of room.roles) counts.set(t(ROLES[role].name), (counts.get(t(ROLES[role].name)) ?? 0) + 1);
  lines.push(t("角色：{roles}", { roles: [...counts].map(([role, count]) => count > 1 ? `${role} ×${count}` : role).join(t("、")) }));
  const winner = game.result.winner === "good" ? t("正义获胜") : t("邪恶获胜");
  lines.push(t("结果：{winner}（{reason}）", { winner, reason: t(REASONS[game.result.reason]) }) + (game.result.targetSeat != null ? ` · ${t("刺杀目标：{target}", { target: name(game.result.targetSeat) })}` : "") + (game.result.early ? ` · ${t("提前出刀")}` : ""));

  lines.push("", t("【身份】"));
  if (game.revealedRoles) {
    for (const { seat, role } of game.revealedRoles) { const side = (role === "goodLancelot" || role === "evilLancelot") && game.lancelotsSwitched ? (ROLES[role].side === "good" ? "evil" : "good") : ROLES[role].side; lines.push(t("{player} — {role}（{side}）", { player: name(seat), role: t(ROLES[role].name), side: side === "good" ? t("正义") : t("邪恶") })); }
  } else {
    lines.push(t("完整身份仅向本局成员揭晓。"));
  }
  if (game.publicReveals.length) lines.push(t("对局中公开：{list}", { list: game.publicReveals.map(({ seat, role }) => t("{player} 是{role}", { player: name(seat), role: t(ROLES[role].name) })).join(t("；")) }));

  lines.push("", t("【任务】"));
  if (!game.quests.length) lines.push(t("没有完成的任务。"));
  for (const quest of game.quests) {
    lines.push(t("任务 {quest}：{outcome} · 队员 {team} · {successes} 张成功牌、{fails} 张失败牌", { quest: quest.quest, outcome: quest.success ? t("成功") : t("失败"), team: seats(quest.team), successes: quest.team.length - quest.failCount, fails: quest.failCount }));
    const cards = game.questCards?.find(item => item.quest === quest.quest)?.cards ?? [];
    if (cards.length) lines.push(t("  出牌：{cards}", { cards: cards.map(({ seat, card }) => t("{player} {card}", { player: name(seat), card: card === "fail" ? t("失败") : t("成功") })).join(t("、")) }));
  }

  lines.push("", t("【组队表决】"));
  if (!game.proposals.length) lines.push(t("没有组队记录。"));
  for (const proposal of game.proposals) {
    const yes = proposal.votes.filter(vote => vote.approve).map(vote => vote.seat).sort((a, b) => a - b);
    const no = proposal.votes.filter(vote => !vote.approve).map(vote => vote.seat).sort((a, b) => a - b);
    lines.push(t("任务 {quest} 第 {attempt} 次 · 队长 {leader} · 队员 {team} → {outcome}（赞成 {yes}：{yesSeats}；反对 {no}：{noSeats}）", {
      quest: proposal.quest, attempt: proposal.attempt, leader: name(proposal.leaderSeat), team: seats(proposal.team),
      outcome: proposal.approved ? t("通过") : t("否决"), yes: yes.length, yesSeats: seats(yes), no: no.length, noSeats: seats(no),
    }));
  }

  lines.push("", t("【玩家统计】"));
  for (const row of seatStats(room, game)) {
    lines.push(t("{player}：当队长 {led} 次 · 被选上车 {picked} 次 · 执行任务 {played} 次 · 赞成率 {rate}", { player: name(row.seat), led: row.led, picked: row.picked, played: row.played, rate: row.votes ? `${Math.round(row.approvals / row.votes * 100)}%` : "—" }));
  }
  lines.push("", t("对局中任务牌只公布张数；以上出牌记录在结局后公开，仅本局成员可见。"));
  return lines.join("\n") + "\n";
}
