"use client";

import { useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { ROLES, type RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { MAX_DRAFT_LENGTH, usePlayerNotes, markGlyph, type Mark } from "@/lib/player-notes";

/** Small one-character tag for a private mark. */
export function MarkTag({ mark }: { mark?: Mark }) {
  const { t } = useI18n();
  if (!mark?.side) return null;
  const label = mark.role ? t(ROLES[mark.role].name) : mark.side === "good" ? t("好人") : t("坏人");
  return <span className={`mark-tag ${mark.side}`} title={label}>{markGlyph(mark)}<span className="sr-only">{label}</span></span>;
}

/** My private marks and notes for this room and game (this device only). */
export function PlayerNotesPanel({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const { notes, setDraft, clear } = usePlayerNotes(room.code, room.round, room.roles);
  const [confirmClear, setConfirmClear] = useState(false);
  if (!room.meId) return null;
  const others = room.players.filter(player => player.id !== room.meId);
  const marked = others.filter(player => notes.marks[player.seat]?.side).length;
  return (
    <details id="room-notes" className="player-notes">
      <summary>
        <span className="player-notes-title"><NotebookPen size={18} aria-hidden="true" /><span>{t("我的推理笔记")}</span></span>
        <small>{notes.draft ? t("已标记 {n} / {total} 人 · 有发言草稿", { n: marked, total: others.length }) : t("已标记 {n} / {total} 人", { n: marked, total: others.length })}</small>
        <ChevronDown className="player-notes-chevron" size={17} aria-hidden="true" />
      </summary>
      <p className="player-notes-hint">{t("只保存在这台设备，不会发给服务器或其他玩家；同房再开后换一张新笔记。点圆桌上其他玩家的头像，选一个字标在右上角。")}</p>
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
      <div className="player-notes-footer">
        {!confirmClear
          ? <button type="button" className="text-button subtle" onClick={() => setConfirmClear(true)}>{t("清空本局笔记")}</button>
          : <span>{t("确定清空发言准备和头像上的标记？")}<button type="button" className="text-button" onClick={() => { clear(); setConfirmClear(false); }}>{t("清空")}</button><button type="button" className="text-button subtle" onClick={() => setConfirmClear(false)}>{t("取消")}</button></span>}
      </div>
    </details>
  );
}
