"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { replayFileName, replayText } from "@/lib/replay";

/** Copy or download the finished game's replay as plain text. */
export function ReplayExport({ room }: { room: RoomView }) {
  const { lang, t } = useI18n();
  const [status, setStatus] = useState<"" | "copied" | "saved">("");
  const [fallback, setFallback] = useState<string | null>(null);
  if (!room.game?.result) return null;

  const copy = async () => {
    const text = replayText(room, new Date(), lang);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied"); setFallback(null);
      setTimeout(() => setStatus(current => current === "copied" ? "" : current), 2500);
    } catch {
      // Some in-app browsers refuse clipboard access: show the text to copy by hand.
      setFallback(text); setStatus("");
    }
  };
  const download = () => {
    const now = new Date(), text = replayText(room, now, lang);
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = replayFileName(room, now);
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("saved");
  };

  return (
    <div className="replay-export">
      <div className="replay-export-actions">
        <button type="button" className="secondary-button" onClick={() => void copy()}>{status === "copied" ? <Check size={16} /> : <Copy size={16} />}{status === "copied" ? t("已复制复盘") : t("复制复盘文字")}</button>
        <button type="button" className="secondary-button" onClick={download}><Download size={16} />{t("下载 .txt")}</button>
      </div>
      <p className="action-note" role="status">{status === "saved" ? t("复盘文件已生成，请在下载中查看。") : t("包含身份、每次任务谁出了哪张牌和全部表决。房间过期后记录会删除，想留存请现在导出。")}</p>
      {fallback && <textarea className="replay-fallback" readOnly value={fallback} rows={8} aria-label={t("复盘文字，可手动全选复制")} onFocus={event => event.currentTarget.select()} />}
    </div>
  );
}
