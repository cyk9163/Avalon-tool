"use client";

import { useI18n } from "@/lib/i18n/react";

export function RecordRow({ won, mvp, role, score, highlight, meta }: {
  won: boolean;
  mvp: boolean;
  role: string;
  score: number | null;
  highlight: string | null;
  meta?: string;
}) {
  const { t, lang } = useI18n();
  const loss = lang === "en" ? "Defeat" : t("失败");
  return <>
    <span className={`record-result ${won ? "win" : "loss"}`}>
      <b>{won ? t("胜利") : loss}</b>
      {mvp && <span className="mvp-badge">MVP</span>}
    </span>
    <span className="record-role">{role}</span>
    <span className="record-score">{typeof score === "number" ? score : "—"}</span>
    <span className="record-highlight">{highlight ?? "—"}</span>
    {meta && <small className="record-meta">{meta}</small>}
  </>;
}
