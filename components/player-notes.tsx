"use client";

import { useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { ROLES, type Role, type RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { MAX_DRAFT_LENGTH, MAX_NOTE_LENGTH, usePlayerNotes, type Mark } from "@/lib/player-notes";

/** Small tag showing my private mark for a seat, for use next to player names. */
export function MarkTag({ mark }: { mark?: Mark }) {
  const { t } = useI18n();
  if (!mark?.side) return null;
  return <span className={`mark-tag ${mark.side}`}>{mark.role ? t(ROLES[mark.role].name) : mark.side === "good" ? t("好人") : t("坏人")}</span>;
}

/** My private marks and notes for this room and game (this device only). */
export function PlayerNotesPanel({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const { notes, setMark, setNote, setDraft, clear } = usePlayerNotes(room.code, room.round, room.roles);
  const [confirmClear, setConfirmClear] = useState(false);
  if (!room.meId || !room.game && room.phase !== "identity" && room.phase !== "ready") return null;
  const others = room.players.filter(player => player.id !== room.meId).sort((a, b) => a.seat - b.seat);
  const boardRoles = [...new Set(room.roles)];
  const marked = others.filter(player => notes.marks[player.seat]?.side || notes.notes[player.seat]).length;
  return (
    <details id="room-notes" className="player-notes">
      <summary>
        <span className="player-notes-title"><NotebookPen size={18} aria-hidden="true" /><span>{t("我的推理笔记")}</span></span>
        <small>{notes.draft ? t("已标记 {n} / {total} 人 · 有发言草稿", { n: marked, total: others.length }) : t("已标记 {n} / {total} 人", { n: marked, total: others.length })}</small>
        <ChevronDown className="player-notes-chevron" size={17} aria-hidden="true" />
      </summary>
      <p className="player-notes-hint">{t("只保存在这台设备，不会发给服务器或其他玩家；同房再开后换一张新笔记。")}</p>
      <label className="player-draft">
        <span>{t("我的发言准备")}</span>
        <textarea
          placeholder={t("先写好轮到自己时想说的：怎么表水、想推谁上车、为什么这样投票…")}
          maxLength={MAX_DRAFT_LENGTH}
          rows={notes.draft ? 4 : 3}
          value={notes.draft}
          onChange={event => setDraft(event.target.value)}
        />
        <small>{t("{n} / {max} 字", { n: notes.draft.length, max: MAX_DRAFT_LENGTH })}</small>
      </label>
      <ul className="player-notes-list">
        {others.map(player => {
          const mark = notes.marks[player.seat];
          const side = (value: "good" | "evil" | null) => setMark(player.seat, value ? { side: value } : null);
          return (
            <li key={player.id} className={mark?.side ? `marked ${mark.side}` : undefined}>
              <div className="player-notes-head">
                <span className="player-number">{player.seat}</span>
                <strong>{player.name || t("已入座")}</strong>
                <MarkTag mark={mark} />
              </div>
              <div className="player-notes-controls">
                <div className="mark-sides" role="radiogroup" aria-label={t("{n} 号的阵营", { n: player.seat })}>
                  <button type="button" role="radio" aria-checked={mark?.side === "good" && !mark.role} className={mark?.side === "good" && !mark.role ? "on good" : undefined} onClick={() => side("good")}>{t("好人")}</button>
                  <button type="button" role="radio" aria-checked={mark?.side === "evil" && !mark.role} className={mark?.side === "evil" && !mark.role ? "on evil" : undefined} onClick={() => side("evil")}>{t("坏人")}</button>
                  <button type="button" role="radio" aria-checked={!mark?.side} className={!mark?.side ? "on" : undefined} onClick={() => side(null)}>{t("未知")}</button>
                </div>
                <select aria-label={t("{n} 号可能的身份", { n: player.seat })} value={mark?.role ?? ""} onChange={event => setMark(player.seat, event.target.value ? { role: event.target.value as Role } : mark?.side ? { side: mark.side } : null)}>
                  <option value="">{t("猜身份…")}</option>
                  {boardRoles.map(role => <option key={role} value={role}>{t("{role}（{side}）", { role: t(ROLES[role].name), side: ROLES[role].side === "good" ? t("好人") : t("坏人") })}</option>)}
                </select>
              </div>
              <textarea
                aria-label={t("{n} 号的发言备注", { n: player.seat })}
                placeholder={t("记下发言、站边、投票理由…")}
                maxLength={MAX_NOTE_LENGTH}
                rows={notes.notes[player.seat] ? 2 : 1}
                value={notes.notes[player.seat] ?? ""}
                onChange={event => setNote(player.seat, event.target.value)}
              />
            </li>
          );
        })}
      </ul>
      <div className="player-notes-footer">
        {!confirmClear
          ? <button type="button" className="text-button subtle" onClick={() => setConfirmClear(true)}>{t("清空本局笔记")}</button>
          : <span>{t("确定清空所有标记、备注和发言草稿？")}<button type="button" className="text-button" onClick={() => { clear(); setConfirmClear(false); }}>{t("清空")}</button><button type="button" className="text-button subtle" onClick={() => setConfirmClear(false)}>{t("取消")}</button></span>}
      </div>
    </details>
  );
}
