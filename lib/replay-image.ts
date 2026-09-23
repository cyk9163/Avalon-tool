// Recap as a tall image (v1.9) for sharing in a group chat: result, roles,
// quests (with who played which card, after the game) and the vote matrix.
// Drawn on the phone with <canvas>; nothing is sent to the server. Uses only
// the viewer's own RoomView, like the text recap.
import { PRESETS, ROLES, type RoomView } from "./game.ts";
import { gameHighlights } from "./highlights.ts";
import { msg, translate, type Lang, type Vars } from "./i18n/core.ts";
import { replayDate } from "./replay.ts";

const W = 1080, PAD = 64;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
const C = {
  bg: "#10201e", panel: "#16292a", line: "#314a49", text: "#e8e4d6", muted: "#9fb4ac",
  gold: "#dbc18a", good: "#9bcab7", evil: "#e9a59c",
};
const REASONS = {
  "three-failures": msg("三次任务失败"),
  "five-rejections": msg("连续五次组队被否决"),
  "merlin-assassinated": msg("刺客找到了梅林"),
  "assassin-missed": msg("刺客没有找到梅林"),
} as const;

export function replayImageName(room: Pick<RoomView, "round">, date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `avalon-replay-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}-r${room.round}.png`;
}

/** Returns null until the game has a result. */
export function drawReplayImage(room: RoomView, lang: Lang = "zh", date = new Date()): HTMLCanvasElement | null {
  const game = room.game;
  if (!game?.result) return null;
  const t = (zh: string, vars?: Vars) => translate(lang, zh, vars);
  const seats = [...room.players].sort((a, b) => a.seat - b.seat);
  const roles = game.revealedRoles ?? [];
  const cards = game.questCards ?? [];
  const finalSide = (role: keyof typeof ROLES) => (role === "goodLancelot" || role === "evilLancelot") && game.lancelotsSwitched
    ? (ROLES[role].side === "good" ? "evil" : "good") : ROLES[role].side;

  const identityRows = Math.ceil(roles.length / 2);
  const cardLines = game.quests.filter(quest => cards.some(item => item.quest === quest.quest && item.cards.length)).length;
  const highlightName = (seat: number) => {
    const player = seats.find(item => item.seat === seat)?.name ?? "";
    return player ? t("{seat} 号 {name}", { seat, name: player }) : t("{seat} 号", { seat });
  };
  const highs = gameHighlights(game, game.revealedRoles, highlightName, t("、"));
  const height = 250 + 190 + (highs.length ? 100 + highs.length * 44 : 0) + (roles.length ? 110 + identityRows * 76 : 0) + 110 + 190 + cardLines * 46
    + (game.proposals.length ? 150 + (game.proposals.length + 1) * 52 : 0) + 110;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const font = (size: number, weight = 400) => { ctx.font = `${weight} ${size}px ${FONT}`; };
  const text = (value: string, x: number, y: number, color = C.text, size = 30, weight = 400, align: CanvasTextAlign = "left", max?: number) => {
    font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle";
    let shown = value;
    if (max) while (shown.length > 1 && ctx.measureText(shown).width > max) shown = shown.slice(0, -2) + "…";
    ctx.fillText(shown, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lineWidth = 2) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  };
  const tick = (x: number, y: number, s: number, color: string) => {
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s / 3, y + s * .7); ctx.lineTo(x + s, y - s * .7);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  };
  const cross = (x: number, y: number, s: number, color: string) => {
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
  };
  const heading = (value: string, y: number) => {
    text(value, PAD, y, C.gold, 30, 600);
    ctx.fillStyle = C.line; ctx.fillRect(PAD, y + 30, W - PAD * 2, 2);
  };
  const name = (seat: number) => seats.find(player => player.seat === seat)?.name ?? "";

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, height);
  // Header.
  let y = 96;
  text(t("圆桌 · 阿瓦隆复盘"), PAD, y, C.text, 52, 700);
  const preset = t(PRESETS[room.preset].name);
  text(t("{date} · 第 {round} 局 · {count} 人 · {board}", { date: replayDate(date), round: room.round, count: room.capacity, board: room.ladyOfLake ? t("{board} + 湖中仙女", { board: preset }) : preset }), PAD, y + 66, C.muted, 28);
  y = 250;

  // Result.
  const winnerColor = game.result.winner === "good" ? C.good : C.evil;
  box(PAD, y, W - PAD * 2, 160, 24, C.panel, winnerColor + "88");
  text(game.result.winner === "good" ? t("正义获胜") : t("邪恶获胜"), W / 2, y + 60, winnerColor, 56, 700, "center");
  const target = game.result.targetSeat != null ? ` · ${t("刺杀目标：{target}", { target: `${game.result.targetSeat} ${name(game.result.targetSeat)}` })}` : "";
  text(t(REASONS[game.result.reason]) + target + (game.result.early ? ` · ${t("提前出刀")}` : ""), W / 2, y + 120, C.muted, 28, 400, "center", W - PAD * 3);
  y += 190;

  if (highs.length) {
    heading(t("本局高光"), y + 20);
    y += 80;
    for (const item of highs) {
      text(t(item.key, item.vars), PAD, y, C.text, 26, 500, "left", W - PAD * 2);
      y += 44;
    }
    y += 16;
  }

  // Roles, two columns.
  if (roles.length) {
    heading(t("身份"), y + 20);
    y += 90;
    const colW = (W - PAD * 2 - 24) / 2;
    roles.forEach(({ seat, role }, index) => {
      const x = PAD + (index % 2) * (colW + 24), rowY = y + Math.floor(index / 2) * 76;
      const side = finalSide(role);
      box(x, rowY, colW, 62, 14, C.panel);
      ctx.beginPath(); ctx.arc(x + 34, rowY + 31, 20, 0, Math.PI * 2); ctx.fillStyle = "#243b38"; ctx.fill();
      text(String(seat), x + 34, rowY + 32, C.gold, 24, 700, "center");
      text(name(seat), x + 66, rowY + 31, C.text, 28, 500, "left", colW * .42);
      text(t(ROLES[role].name), x + colW - 18, rowY + 31, side === "good" ? C.good : C.evil, 28, 600, "right", colW * .45);
    });
    y += identityRows * 76 + 20;
  }

  // Quests.
  heading(t("任务"), y + 20);
  y += 80;
  const qW = (W - PAD * 2 - 4 * 16) / 5;
  for (let number = 1; number <= 5; number++) {
    const quest = game.quests.find(item => item.quest === number);
    const x = PAD + (number - 1) * (qW + 16);
    const color = quest ? quest.success ? C.good : C.evil : C.line;
    box(x, y, qW, 160, 18, C.panel, color, quest ? 3 : 2);
    text(t("任务 {n}", { n: number }), x + qW / 2, y + 32, C.muted, 24, 400, "center");
    if (quest) {
      if (quest.success) tick(x + qW / 2, y + 78, 18, C.good); else cross(x + qW / 2, y + 78, 15, C.evil);
      text(t("{n} 张失败", { n: quest.failCount }), x + qW / 2, y + 128, color, 22, 500, "center");
    } else {
      text("—", x + qW / 2, y + 88, C.muted, 30, 400, "center");
    }
  }
  y += 190;
  for (const quest of game.quests) {
    const played = cards.find(item => item.quest === quest.quest)?.cards ?? [];
    if (!played.length) continue;
    text(t("任务 {n}", { n: quest.quest }), PAD, y, C.muted, 24);
    let x = PAD + 120;
    for (const { seat, card } of played) {
      const label = `${seat} ${card === "fail" ? t("失败") : t("成功")}`;
      font(24, 600);
      const w = ctx.measureText(label).width + 28;
      box(x, y - 18, w, 36, 18, card === "fail" ? C.evil + "22" : C.good + "22");
      text(label, x + 14, y, card === "fail" ? C.evil : C.good, 24, 600);
      x += w + 10;
    }
    y += 46;
  }

  // Vote matrix: one row per proposal, one column per seat.
  if (game.proposals.length) {
    y += 10;
    heading(t("组队表决"), y + 20);
    y += 90;
    const firstCol = 110, lastCol = 120;
    const cell = (W - PAD * 2 - firstCol - lastCol) / seats.length;
    text(t("车"), PAD + 10, y, C.muted, 24);
    seats.forEach((player, index) => text(String(player.seat), PAD + firstCol + index * cell + cell / 2, y, C.muted, 24, 600, "center"));
    text(t("结果"), W - PAD - lastCol / 2, y, C.muted, 24, 400, "center");
    y += 52;
    for (const proposal of game.proposals) {
      text(`${proposal.quest}·${proposal.attempt}`, PAD + 10, y, C.gold, 26, 600);
      seats.forEach((player, index) => {
        const cx = PAD + firstCol + index * cell + cell / 2;
        const vote = proposal.votes.find(item => item.seat === player.seat);
        if (proposal.team.includes(player.seat)) box(cx - cell / 2 + 4, y - 22, cell - 8, 44, 10, undefined, C.gold, 2);
        if (proposal.leaderSeat === player.seat) { ctx.beginPath(); ctx.arc(cx + 22, y - 14, 6, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill(); }
        if (vote) (vote.approve ? tick : cross)(cx, y, vote.approve ? 11 : 9, vote.approve ? C.good : C.evil);
      });
      text(proposal.approved ? t("通过") : t("否决"), W - PAD - lastCol / 2, y, proposal.approved ? C.good : C.evil, 26, 600, "center");
      y += 52;
    }
    text(t("金框：在车上 · 金点：队长"), PAD, y + 4, C.muted, 22);
    y += 40;
  }

  // Footer.
  text(t("圆桌 · 阿瓦隆助手"), W / 2, height - 50, C.muted, 24, 400, "center");
  return canvas;
}
