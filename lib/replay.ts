// Plain-text replay of a finished game (v0.11), for copying into a chat or
// saving as a file. Built only from the viewer's own RoomView, which never
// contains quest cards per player, so the export cannot reveal who played a
// fail card. Private lake-of-the-lake results are left out as well.
import { PRESETS, ROLES, type RoomView } from "./game.ts";

const REASONS = {
  "three-failures": "三次任务失败",
  "five-rejections": "连续五次组队被否决",
  "merlin-assassinated": "刺客找到了梅林",
  "assassin-missed": "刺客没有找到梅林",
} as const;

function pad(value: number) { return String(value).padStart(2, "0"); }

export function replayDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function replayFileName(room: Pick<RoomView, "round">, date: Date): string {
  return `avalon-replay-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}-r${room.round}.txt`;
}

/** Returns null until the game has a result. */
export function replayText(room: RoomView, date = new Date()): string | null {
  const game = room.game;
  if (!game?.result) return null;
  const name = (seat: number) => {
    const player = room.players.find(item => item.seat === seat);
    return player?.name ? `${seat} 号 ${player.name}` : `${seat} 号`;
  };
  const seats = (list: number[]) => list.length ? list.map(seat => `${seat}`).join("、") + " 号" : "无";
  const lines: string[] = [];
  const board = PRESETS[room.preset].name + (room.ladyOfLake ? " + 湖中仙女" : "");
  lines.push("圆桌 · 阿瓦隆复盘");
  lines.push(`${replayDate(date)} · 第 ${room.round} 局 · ${room.capacity} 人 · ${board}`);
  const counts = new Map<string, number>();
  for (const role of room.roles) counts.set(ROLES[role].name, (counts.get(ROLES[role].name) ?? 0) + 1);
  lines.push(`角色：${[...counts].map(([role, count]) => count > 1 ? `${role} ×${count}` : role).join("、")}`);
  const winner = game.result.winner === "good" ? "正义获胜" : "邪恶获胜";
  lines.push(`结果：${winner}（${REASONS[game.result.reason]}）${game.result.targetSeat != null ? ` · 刺杀目标：${name(game.result.targetSeat)}` : ""}`);

  lines.push("", "【身份】");
  if (game.revealedRoles) {
    for (const { seat, role } of game.revealedRoles) lines.push(`${name(seat)} — ${ROLES[role].name}（${ROLES[role].side === "good" ? "正义" : "邪恶"}）`);
  } else {
    lines.push("完整身份仅向本局成员揭晓。");
  }
  if (game.publicReveals.length) lines.push(`对局中公开：${game.publicReveals.map(({ seat, role }) => `${name(seat)} 是${ROLES[role].name}`).join("；")}`);

  lines.push("", "【任务】");
  if (!game.quests.length) lines.push("没有完成的任务。");
  for (const quest of game.quests) {
    lines.push(`任务 ${quest.quest}：${quest.success ? "成功" : "失败"} · 队员 ${seats(quest.team)} · ${quest.failCount} 张失败牌`);
  }

  lines.push("", "【组队表决】");
  if (!game.proposals.length) lines.push("没有组队记录。");
  for (const proposal of game.proposals) {
    const yes = proposal.votes.filter(vote => vote.approve).map(vote => vote.seat).sort((a, b) => a - b);
    const no = proposal.votes.filter(vote => !vote.approve).map(vote => vote.seat).sort((a, b) => a - b);
    lines.push(`任务 ${proposal.quest} 第 ${proposal.attempt} 次 · 队长 ${name(proposal.leaderSeat)} · 队员 ${seats(proposal.team)} → ${proposal.approved ? "通过" : "否决"}（赞成 ${yes.length}：${seats(yes)}；反对 ${no.length}：${seats(no)}）`);
  }

  lines.push("", "任务牌只记录失败牌数量，不包含谁出了哪张牌。");
  return lines.join("\n") + "\n";
}
