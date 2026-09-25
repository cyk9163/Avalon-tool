"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { RoomView } from "@/lib/game";
import { EVIL_COUNTS, PRESETS } from "@/lib/game";
import { RoleChips } from "@/components/seat-table";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/react";

/** The rules that apply to this room, so the whole table agrees before play (v1.6). */
function roomRules(room: RoomView): string[] {
  const roles = new Set(room.roles);
  const rules = [
    msg("身份随机发放。第一局队长随机，同一房间的下一局队长按座位顺延一位；一局之内仍按座位顺序轮换。"),
    msg("组队表决严格过半才通过，平票算否决。同一任务连续两次否决后，第三车不表决，直接执行任务。"),
  ];
  if (room.capacity >= 7) rules.push(msg("第 4 次任务需要 2 张失败牌才算失败。"));
  rules.push(room.evilSeesOberon
    ? msg("坏人互相知道具体角色，并且知道奥伯伦是谁；奥伯伦不知道队友。梅林只知道谁是坏人，看不到莫德雷德。")
    : msg("坏人互相知道彼此的具体角色（奥伯伦除外）；梅林只知道谁是坏人，看不到莫德雷德。"));
  rules.push(msg("刺客可以在对局中随时出刀一次：刺中梅林邪恶获胜，刺错正义获胜；没出刀则在三次任务成功后刺杀。"));
  if (roles.has("goodLancelot")) rules.push(msg("兰斯洛特：开局公开第 3–5 轮的忠诚牌，翻到「转换」两人互换阵营；属于正义只能出成功，属于邪恶只能出失败。"));
  if (room.ladyOfLake) rules.push(msg("湖中仙女：第 2、3、4 次任务后，持有者私下查验一人阵营，令牌交给对方。"));
  if (roles.has("lunatic")) rules.push(msg("疯子参加任务只能出失败。"));
  if (roles.has("brute")) rules.push(msg("野蛮人在第 4、5 次任务只能出成功。"));
  if (roles.has("revealer")) rules.push(msg("揭露者在第二次任务失败后向全桌公开。"));
  rules.push(msg("对局中任务牌只公布张数；结局后向本局成员公开全部身份和每个人出的牌。"));
  return rules;
}

export function RulesList({ room }: { room: RoomView }) {
  const { t } = useI18n();
  return <ul className="rules-list">{roomRules(room).map(rule => <li key={rule}>{t(rule)}</li>)}</ul>;
}

/** Lobby card: the table reads the rules together before dealing roles. */
export function RulesCard({ room }: { room: RoomView }) {
  const { t } = useI18n();
  return (
    <section className="config-card rules-card">
      <div className="config-heading"><h3><ScrollText size={16} aria-hidden="true" />{t("本局规则")}</h3><Link href="/rules">{t("完整规则")}</Link></div>
      <RulesList room={room} />
    </section>
  );
}

export function BoardRulesButton({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="board-rules-button" onClick={() => setOpen(true)}>{t("规则")}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rules-dialog">
        <DialogTitle>{t("板子与规则")}</DialogTitle>
        <DialogDescription>{t("所有人使用同一套规则；有疑问以这里为准。")}</DialogDescription>
        <div className="config-heading"><h3>{t("本局阵容")}</h3><span>{t(PRESETS[room.preset].name)}</span></div>
        <div className="alignment-line"><span><i />{t("{n} 位好人", { n: room.capacity - EVIL_COUNTS[room.capacity] })}</span><span><i />{t("{n} 位坏人", { n: EVIL_COUNTS[room.capacity] })}</span></div>
        <RoleChips roles={room.roles} />
        {room.ladyOfLake && <p className="module-badge">{t("湖中仙女 · 已启用")}</p>}
        <p className="module-badge">{room.turnSpeech ? t("轮流发言 · 已启用") : t("线下讨论 · 亮车后直接表决")}</p>
        {room.evilSeesOberon && <p className="module-badge">{t("坏人认识奥伯伦 · 已启用")}</p>}
        <RulesList room={room} />
        <Link className="rules-dialog-link" href="/rules" onClick={() => setOpen(false)}>{t("完整规则与角色图鉴 →")}</Link>
      </DialogContent>
    </Dialog>
  </>;
}
