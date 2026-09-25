"use client";

import Link from "next/link";
import { Check, Crown, Shield, Swords } from "lucide-react";
import { ROLES, type Role, type RoomView } from "@/lib/game";
import { RoleInfoButton } from "@/components/role-info";
import { useI18n } from "@/lib/i18n/react";

export function Brand({ onHome }: { onHome: () => void }) {
  const { t } = useI18n();
  return <Link className="brand" href="/" onClick={event => { event.preventDefault(); onHome(); }} aria-label={t("圆桌首页")}><span className="brand-icon"><Crown size={22} /></span><span>{t("圆桌")}<span className="brand-sub">AVALON</span></span></Link>;
}

export function RoleChips({ roles }: { roles: Role[] }) {
  const { t } = useI18n();
  return <div className="role-chips">{[...new Set(roles)].map(role => <RoleInfoButton role={role} className={`role-chip ${ROLES[role].side}`} key={role}>{ROLES[role].side === "good" ? <Shield size={11} aria-hidden="true" /> : <Swords size={11} aria-hidden="true" />}{t(ROLES[role].name)}{roles.filter(item => item === role).length > 1 ? ` ×${roles.filter(item => item === role).length}` : ""}</RoleInfoButton>)}</div>;
}

export function SeatTable({ count, room, onSeat, disabled }: { count: number; room?: RoomView | null; onSeat?: (seat: number) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return <div className={`roundtable ${room ? "live-table" : ""}`}><div className="table-center"><Crown size={32} strokeWidth={1.3} /><span>AVALON</span><p>{room ? t("{n} / {count} 位已入座", { n: room.players.length, count }) : t("每个人，都有自己的秘密。")}</p></div>{Array.from({ length: count }, (_, index) => {
    const seat = index + 1;
    const player = room?.players.find(item => item.seat === seat), mine = !!player && player.id === room?.meId;
    const canAsk = !!player && !mine && !!onSeat && !disabled && room?.phase === "lobby";
    const label = player
      ? mine ? t("{seat} 号座位，{name}，我", { seat, name: player.name })
        : canAsk ? t("{seat} 号座位，{name}，申请互换", { seat, name: player.name })
          : t("{seat} 号座位，{name}", { seat, name: player.name })
      : t("{seat} 号座位，空位", { seat });
    return <div className="seat-position" key={seat} style={{ left: `${50 + 40 * Math.sin(index * 2 * Math.PI / count)}%`, top: `${50 - 40 * Math.cos(index * 2 * Math.PI / count)}%` }}>
      <button type="button" className={`seat-circle ${player ? "occupied" : ""} ${mine ? "mine" : ""} ${canAsk ? "can-ask" : ""}`} disabled={disabled || !onSeat || (!!player && !canAsk)} onClick={() => onSeat?.(seat)} aria-label={label}>
        <span>{String(seat).padStart(2, "0")}</span>
        {player && (room?.phase === "lobby" ? player.ready : player.confirmed) && <Check className="seat-check" size={14} />}
      </button>
      {room && <span className={`seat-name ${mine ? "mine" : ""}`}>{player ? `${player.name || t("已入座")}${mine ? ` · ${t("我")}` : ""}` : t("待入座")}</span>}
    </div>;
  })}</div>;
}
