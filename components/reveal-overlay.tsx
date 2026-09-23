"use client";

import { useEffect, useState } from "react";
import { Check, Shield, Swords, X } from "lucide-react";
import type { QuestResult, RoomView, TeamProposal } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

type Reveal = { kind: "vote"; proposal: TeamProposal } | { kind: "quest"; quest: QuestResult; cards: ("success" | "fail")[] };

const COUNTDOWN_MS = 1800;
const STEP_MS = 160;
const HOLD_MS = 2200;

/** Only the counts are public, so the order is arbitrary: fails are rotated into the row. */
function arrangedCards(quest: QuestResult): ("success" | "fail")[] {
  const cards = [...Array(quest.team.length - quest.failCount).fill("success"), ...Array(quest.failCount).fill("fail")] as ("success" | "fail")[];
  const shift = (quest.quest * 3) % cards.length;
  return [...cards.slice(shift), ...cards.slice(0, shift)];
}

/**
 * The moment of truth (v1.8): when a team vote or a quest resolves while you
 * watch, count down 3-2-1, turn the ballots over one by one and show the
 * outcome. Tap to skip. With "reduce motion" the outcome shows at once.
 * Opening the room later does not replay old results.
 */
export function RevealOverlay({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const proposals = room.game?.proposals.length ?? 0;
  const quests = room.game?.quests.length ?? 0;
  const [seen, setSeen] = useState({ proposals, quests });
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // Adjust state while rendering when new results arrive (React's documented pattern).
  if (seen.proposals !== proposals || seen.quests !== quests) {
    const game = room.game;
    if (game && quests === seen.quests + 1 && proposals >= seen.proposals) {
      const quest = game.quests.at(-1)!;
      setReveal({ kind: "quest", quest, cards: arrangedCards(quest) });
    } else if (game && proposals === seen.proposals + 1 && quests === seen.quests) {
      setReveal({ kind: "vote", proposal: game.proposals.at(-1)! });
    }
    setSeen({ proposals, quests });
  }

  const count = reveal ? reveal.kind === "vote" ? reveal.proposal.votes.length : reveal.cards.length : 0;
  useEffect(() => {
    if (!reveal) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setReveal(null), reduce ? HOLD_MS : COUNTDOWN_MS + count * STEP_MS + HOLD_MS + 600);
    return () => clearTimeout(timer);
  }, [reveal, count]);

  if (!reveal) return null;
  const resultDelay = `${COUNTDOWN_MS + count * STEP_MS + 200}ms`;
  const good = reveal.kind === "vote" ? reveal.proposal.approved : reveal.quest.success;
  const yes = reveal.kind === "vote" ? reveal.proposal.votes.filter(vote => vote.approve).length : 0;

  return (
    <div className="reveal-overlay" role="dialog" aria-modal="false" aria-label={reveal.kind === "vote" ? t("表决揭晓") : t("任务结果揭晓")} onClick={() => setReveal(null)}>
      <div className="reveal-card">
        <p className="reveal-title">{reveal.kind === "vote"
          ? t("任务 {q} · 第 {a} 车表决", { q: reveal.proposal.quest, a: reveal.proposal.attempt })
          : t("任务 {n} 的任务牌", { n: reveal.quest.quest })}</p>
        <div className="reveal-countdown" aria-hidden="true"><span>3</span><span>2</span><span>1</span></div>
        <div className={`reveal-ballots ${reveal.kind}`}>
          {reveal.kind === "vote"
            ? reveal.proposal.votes.map((vote, index) => (
              <span key={vote.seat} className={`reveal-ballot ${vote.approve ? "yes" : "no"}`} style={{ animationDelay: `${COUNTDOWN_MS + index * STEP_MS}ms` }}>
                <small>{vote.seat}</small>{vote.approve ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                <span className="sr-only">{t("{n} 号", { n: vote.seat })} {vote.approve ? t("赞成") : t("反对")}</span>
              </span>))
            : reveal.cards.map((card, index) => (
              <span key={index} className={`reveal-ballot quest-card ${card === "success" ? "yes" : "no"}`} style={{ animationDelay: `${COUNTDOWN_MS + index * STEP_MS}ms` }}>
                {card === "success" ? <Shield size={20} aria-hidden="true" /> : <Swords size={20} aria-hidden="true" />}
                <span className="sr-only">{card === "success" ? t("成功") : t("失败")}</span>
              </span>))}
        </div>
        <p className={`reveal-result ${good ? "good" : "bad"}`} style={{ animationDelay: resultDelay }}>
          {reveal.kind === "vote"
            ? <>{good ? t("通过") : t("否决")}<small>{t("{yes} 赞成 · {no} 反对", { yes, no: reveal.proposal.votes.length - yes })}</small></>
            : <>{good ? t("任务成功") : t("任务失败")}<small>{t("{n} 张失败", { n: reveal.quest.failCount })}</small></>}
        </p>
        <p className="sr-only" role="status">{reveal.kind === "vote"
          ? t("任务 {q} · 第 {a} 车表决", { q: reveal.proposal.quest, a: reveal.proposal.attempt }) + t("：") + (good ? t("通过") : t("否决")) + t("，") + t("{yes} 赞成 · {no} 反对", { yes, no: reveal.proposal.votes.length - yes })
          : t("任务 {n} 的任务牌", { n: reveal.quest.quest }) + t("：") + (good ? t("任务成功") : t("任务失败")) + t("，") + t("{n} 张失败", { n: reveal.quest.failCount })}</p>
        <button type="button" className="text-button reveal-skip" onClick={() => setReveal(null)}>{t("跳过")}</button>
      </div>
    </div>
  );
}
