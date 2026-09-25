"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/react";

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="help-dialog"><span className="dialog-emblem"><Crown size={26} /></span><DialogTitle>{t("围坐，秘密入局。")}</DialogTitle><DialogDescription>{t("每人一部联网手机，无需注册账号。")}</DialogDescription><ol className="help-list"><li><strong>{t("让朋友入座")}</strong>{t("房主凭 Key 选择人数和角色配置建房，朋友无需 Key，扫码或输入房间码，按实际位置选座。")}</li><li><strong>{t("把身份记在心里")}</strong>{t("全员准备后发身份。按住查看角色与线索，松开隐藏，记住后确认。")}</li><li><strong>{t("让每一票留下线索")}</strong>{t("队长选队，全员表决。任务队员秘密提交任务票，只公布失败总数。")}</li><li><strong>{t("复盘，再来一局")}</strong>{t("刺客可以在对局中随时出刀一次，没出刀则在三次成功后刺杀；三次失败，邪恶获胜。同一任务连续两次否决后，第三车直接执行任务。结束后可以复盘和同房重开。")}</li></ol><p className="help-note">{t("房主可在「房间管理」中移交权限、开局前移出玩家，或中止对局后调整人员。")}</p><p className="help-note">{t("刷新或锁屏后用原来的浏览器返回即可。换了手机或浏览器时，在新设备打开房间，选择「我本来就在这桌」，输入自己的恢复码，或请房主当面核实后批准；原设备会立即失效。房间创建 24 小时后过期。")}</p><p className="help-note help-links"><Link href="/rules" onClick={() => onOpenChange(false)}>{t("完整规则与角色图鉴 →")}</Link><Link href="/me" onClick={() => onOpenChange(false)}>{t("我的战绩")}</Link><Link href="/privacy" onClick={() => onOpenChange(false)}>{t("隐私说明")}</Link></p></DialogContent></Dialog>;
}
