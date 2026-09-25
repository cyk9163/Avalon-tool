"use client";

import { useRef, useState } from "react";
import { NotebookPen, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  const [editing, setEditing] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  if (!room.meId) return null;
  return (
    <section id="room-notes" className="player-notes" aria-label={t("我的推理笔记")}>
      <div className="player-notes-bar">
        <span className="player-notes-title"><NotebookPen size={18} aria-hidden="true" /><span>{t("我的推理笔记")}</span></span>
        <button type="button" className="secondary-button notes-edit" onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" />{t("编辑")}</button>
      </div>
      <div className="notes-preview" tabIndex={0}>
        {notes.draft ? notes.draft : <p className="notes-preview-empty">{t("还没有笔记。点编辑开始写。")}</p>}
      </div>
      <div className="player-notes-footer">
        <small>{t("{n} / {max} 字", { n: notes.draft.length, max: MAX_DRAFT_LENGTH })}</small>
        {!confirmClear
          ? <button type="button" className="text-button subtle" onClick={() => setConfirmClear(true)}>{t("清空本局笔记")}</button>
          : <span>{t("确定清空发言准备和头像上的标记？")}<button type="button" className="text-button" onClick={() => { clear(); setConfirmClear(false); }}>{t("清空")}</button><button type="button" className="text-button subtle" onClick={() => setConfirmClear(false)}>{t("取消")}</button></span>}
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent
          className="notes-editor"
          showCloseButton={false}
          onOpenAutoFocus={event => { event.preventDefault(); draftRef.current?.focus(); }}
        >
          <div className="notes-editor-bar">
            <DialogTitle>{t("我的发言准备")}</DialogTitle>
            <button type="button" className="primary-button" onClick={() => setEditing(false)}>{t("完成")}</button>
          </div>
          <DialogDescription>{t("只保存在这台设备，不会发给服务器或其他玩家；同房再开后换一张新笔记。点圆桌上其他玩家的头像，选一个字标在右上角。")}</DialogDescription>
          <textarea
            ref={draftRef}
            placeholder={t("先写好轮到自己时想说的：怎么表水、想推谁上车、为什么这样投票…")}
            maxLength={MAX_DRAFT_LENGTH}
            value={notes.draft}
            onChange={event => setDraft(event.target.value)}
          />
          <small>{t("{n} / {max} 字", { n: notes.draft.length, max: MAX_DRAFT_LENGTH })}</small>
        </DialogContent>
      </Dialog>
    </section>
  );
}
