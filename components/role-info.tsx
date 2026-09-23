"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Info, Swords } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ROLES, type Role } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { ROLE_INFO } from "@/lib/role-info";

/**
 * A role name you can tap (v1.9): opens a small card with the role's side,
 * what it sees, who sees it and which quest cards it may play, so nobody has
 * to leave the room for the rules page.
 */
export function RoleInfoButton({ role, className, children }: { role: Role; className?: string; children?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const info = ROLE_INFO[role];
  const side = ROLES[role].side;
  return (
    <>
      <button type="button" className={`role-info-button ${className ?? ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t("查看角色说明：{role}", { role: t(ROLES[role].name) })}>
        {children ?? t(ROLES[role].name)}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="role-info-dialog">
          <span className={`side-label ${side}`}>{side === "good" ? t("正义阵营") : t("邪恶阵营")}</span>
          <DialogTitle>{t(ROLES[role].name)}</DialogTitle>
          <DialogDescription>{t(ROLES[role].description)}</DialogDescription>
          <dl className="role-info-facts">
            <div><dt><Eye size={15} aria-hidden="true" />{t("你能看到")}</dt><dd>{t(info.sees)}</dd></div>
            <div><dt><EyeOff size={15} aria-hidden="true" />{t("谁能看到你")}</dt><dd>{t(info.seenBy)}</dd></div>
            <div><dt><Swords size={15} aria-hidden="true" />{t("任务牌")}</dt><dd>{t(info.cards)}</dd></div>
          </dl>
          <p className="role-info-note"><Info size={13} aria-hidden="true" />{t("按本站规则：坏人（奥伯伦除外）互相知道具体角色。")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
