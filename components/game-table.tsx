"use client";

import { useState, type ReactNode } from "react";
import { Check, Crown, Mic, Waves } from "lucide-react";
import { ROLES, type GameView, type Role, type RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { MARK_CORNER, MARK_GLYPH, SIDE_GLYPH, markGlyph, type Mark } from "@/lib/player-notes";
import type { TableReplay } from "@/lib/replay-steps";

/**
 * The round table as the game's main view (v1.6): who leads (crown), who is on
 * the team (gold ring), who has voted, who holds the Lady of the Lake, and my
 * own private marks. During team selection the leader picks seats right here.
 * Presentation only: every choice still goes through the existing actions.
 */
export function GameTable({ room, game, selection, onToggle, marks, onMark, replay, center, lockedSeats = [], evilSeats = [] }: {
  room: RoomView;
  game: GameView;
  selection?: number[];
  onToggle?: (seat: number) => void;
  marks: Record<number, Mark>;
  onMark?: (seat: number, mark: Mark | null) => void;
  replay?: TableReplay;
  center?: ReactNode;
  lockedSeats?: number[];
  evilSeats?: number[];
}) {
  const { t } = useI18n();
  const [menuSeat, setMenuSeat] = useState<number | null>(null);
  const count = room.capacity;
  const picking = !replay && !!onToggle && room.phase === "team";
  const onTeam = (seat: number) => replay ? replay.team.includes(seat) : picking ? !!selection?.includes(seat) : room.phase === "team" ? game.draftTeam.includes(seat) : (room.phase === "vote" || room.phase === "quest") && game.team.includes(seat);
  const attempt = replay ? replay.attempt : game.rejections + 1;
  const questNumber = replay ? replay.quest : game.quest;
  const teamSize = replay ? (replay.focus === "lake" ? game.teamSize : Math.max(replay.team.length, 1)) : game.teamSize;
  const hammer = attempt === 3 && (replay ? replay.focus === "proposal" : room.phase === "team" || room.phase === "quest");
  const boardRoles = [...new Set(room.roles)];
  const menuPlayer = room.players.find(player => player.seat === menuSeat);
  const menuMark = menuSeat ? marks[menuSeat] : undefined;
  const choose = (next: Mark | null) => {
    if (menuSeat === null || !onMark) return;
    const evilOnly = evilSeats.includes(menuSeat);
    if (evilOnly) {
      if (!next) return;
      const side = next.role ? ROLES[next.role].side : next.side;
      if (side !== "evil") return;
    }
    const same = !!next && (next.role ? menuMark?.role === next.role : !menuMark?.role && menuMark?.side === next.side);
    if (evilOnly && same) { setMenuSeat(null); return; }
    onMark(menuSeat, next && !same ? next : null);
    setMenuSeat(null);
  };
  return (<>
    <div className={`roundtable game-table${picking ? " picking" : ""}`}>
      <div className="table-center">
        <strong className="game-table-quest">{t("任务 {n}", { n: questNumber })}</strong>
        {replay?.focus === "lake" ? <p>{t("湖中仙女")}</p> : <p>{t("需要 {n} 人 · 第 {a} 车", { n: teamSize, a: attempt })}</p>}
        {hammer && <p className="game-table-hammer">{t("第三车")}</p>}
        {center ?? (picking && <p className="game-table-pick">{t("已选 {n} / {size}", { n: selection?.length ?? 0, size: game.teamSize })}</p>)}
      </div>
      {Array.from({ length: count }, (_, index) => {
        const seat = index + 1;
        const player = room.players.find(item => item.seat === seat);
        const mine = !!player && player.id === room.meId;
        const leader = (replay ? replay.leaderSeat : game.leaderSeat) === seat;
        const team = onTeam(seat);
        const voted = replay ? replay.votedSeats.includes(seat) : room.phase === "vote" && game.votedSeats.includes(seat);
        const lake = replay ? replay.lakeSeat === seat : game.lake?.holderSeat === seat && room.phase !== "finished";
        const speaking = !replay && !!game.speech && game.speech.order[game.speech.index] === seat;
        const revealed = replay ? undefined : game.publicReveals.find(item => item.seat === seat);
        const mark = mine || replay ? undefined : marks[seat];
        const locked = lockedSeats.includes(seat);
        const canMark = !!onMark && !replay && !mine && !!player && !locked;
        const disabled = !picking || (!team && (selection?.length ?? 0) >= game.teamSize);
        const label = [
          t("{n} 号", { n: seat }), player?.name, mine ? t("我") : "",
          leader ? t("队长") : "", team ? (picking ? t("已选入队伍") : room.phase === "team" ? t("队长亮车") : t("在车上")) : "",
          voted ? t("已表决") : "", lake ? t("持有湖中仙女") : "", speaking ? t("正在发言") : "",
          canMark && !picking ? t("点按标记") : "",
        ].filter(Boolean).join(t("，"));
        const Seat = picking || (canMark && !picking) ? "button" : "div";
        const openMenu = () => setMenuSeat(seat);
        return (
          <div className="seat-position" key={seat} style={{ left: `${50 + 40 * Math.sin(index * 2 * Math.PI / count)}%`, top: `${50 - 40 * Math.cos(index * 2 * Math.PI / count)}%` }}>
            <div className="seat-face">
              <Seat
                {...(Seat === "button" ? {
                  type: "button" as const,
                  disabled: picking ? disabled : false,
                  "aria-pressed": picking ? team : undefined,
                  onClick: () => { if (picking) onToggle?.(seat); else openMenu(); },
                } : { role: "img" })}
                aria-label={label}
                className={`seat-circle occupied${mine ? " mine" : ""}${team ? " on-team" : ""}${leader ? " leader" : ""}${mark?.side ? ` marked-${mark.side} has-mark` : ""}${!replay && room.phase === "vote" && !voted ? " pending" : ""}${speaking ? " speaking" : ""}`}
              >
                <span>{String(seat).padStart(2, "0")}</span>
                {leader && <Crown className="seat-badge seat-badge-leader" size={14} aria-hidden="true" />}
                {voted && <Check className="seat-check" size={14} aria-hidden="true" />}
                {speaking && <Mic className="seat-badge seat-badge-speaking" size={13} aria-hidden="true" />}
                {lake && <Waves className="seat-badge seat-badge-lake" size={13} aria-hidden="true" />}
                {mark && (!picking || locked) && <span className={`seat-mark-char ${mark.side}`} aria-hidden="true">{markGlyph(mark)}</span>}
              </Seat>
              {canMark && picking && <button type="button" className={`seat-mark-open${mark?.side ? ` ${mark.side}` : ""}`} aria-label={t("标记 {n} 号", { n: seat })} onClick={openMenu}>{mark ? markGlyph(mark) : MARK_CORNER}</button>}
            </div>
            <span className={`seat-name${mine ? " mine" : ""}`}>{player?.name || t("已入座")}{mine ? ` · ${t("我")}` : ""}</span>
            {revealed && <span className="mark-tag evil seat-mark">{t(ROLES[revealed.role].name)}</span>}
          </div>
        );
      })}
    </div>
    {menuSeat !== null && onMark && <div className="mark-menu-layer" onClick={() => setMenuSeat(null)}>
      <div className="mark-menu" role="dialog" aria-label={t("标记 {n} 号", { n: menuSeat })} onClick={event => event.stopPropagation()}>
        <p>{t("标记 {n} 号", { n: menuSeat })}{menuPlayer?.name ? ` · ${menuPlayer.name}` : ""}</p>
        <div className="mark-menu-grid">
          {(!evilSeats.includes(menuSeat) ? (["good", "evil"] as const) : (["evil"] as const)).map(side => <button type="button" key={side} className={`${side}${!menuMark?.role && menuMark?.side === side ? " on" : ""}`} aria-label={side === "good" ? t("好人") : t("坏人")} aria-pressed={!menuMark?.role && menuMark?.side === side} onClick={() => choose({ side })}>{SIDE_GLYPH[side]}</button>)}
          {boardRoles.filter(role => !evilSeats.includes(menuSeat) || ROLES[role].side === "evil").map(role => <button type="button" key={role} className={`${ROLES[role].side}${menuMark?.role === role ? " on" : ""}`} aria-label={t(ROLES[role].name)} aria-pressed={menuMark?.role === role} onClick={() => choose({ role: role as Role })}>{MARK_GLYPH[role]}</button>)}
        </div>
        <button type="button" className="text-button" onClick={() => setMenuSeat(null)}>{t("取消")}</button>
      </div>
    </div>}
  </>);
}
