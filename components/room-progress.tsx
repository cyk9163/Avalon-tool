import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";

type RoomProgressProps = {
  room: RoomView;
  connected: boolean;
  /** True while the live WebSocket channel is open (v0.9). */
  live?: boolean;
};

type Progress = {
  value: number;
  max: number;
  label: string;
  detail: string;
};

type StageSummary = {
  title: string;
  description: string;
  progress?: Progress;
  tone?: "good" | "evil";
};

function stageSummary(room: RoomView, t: ReturnType<typeof useI18n>["t"]): StageSummary {
  const game = room.game;
  const ready = room.players.filter(player => player.ready).length;
  const confirmed = room.players.filter(player => player.confirmed).length;

  switch (room.phase) {
    case "lobby":
      return {
        title: room.players.length < room.capacity
          ? t("等待朋友入座")
          : ready === room.capacity ? t("等待房主发身份") : t("人已到齐，准备开局"),
        description: t("入座后确认准备，房主将统一分配身份。"),
        progress: {
          value: ready,
          max: room.capacity,
          label: t("准备进度"),
          detail: t("入座 {seated} / {capacity} · 准备 {ready} / {capacity}", { seated: room.players.length, capacity: room.capacity, ready }),
        },
      };
    case "identity":
      return {
        title: t("身份确认中"),
        description: t("各自查看秘密身份，全员确认后进入对局。"),
        progress: {
          value: confirmed,
          max: room.capacity,
          label: t("身份确认"),
          detail: t("{confirmed} / {capacity} 人已确认", { confirmed, capacity: room.capacity }),
        },
      };
    case "ready":
      return {
        title: t("全员就绪"),
        description: t("等待房主开始第一轮任务。"),
        progress: {
          value: room.capacity,
          max: room.capacity,
          label: t("身份确认"),
          detail: t("全员已确认"),
        },
      };
    case "team": {
      if (!game) return { title: t("队长正在选队"), description: t("房间成员正在讨论本次任务的队伍。") };
      const leader = room.players.find(player => player.seat === game.leaderSeat);
      return {
        title: t("任务 {quest} · 等待选队", { quest: game.quest }),
        description: t("队长 {seat} 号 · {name}，本次需选 {size} 人。", { seat: game.leaderSeat, name: leader?.name ?? t("玩家"), size: game.teamSize }),
      };
    }
    case "vote":
      if (!game) return { title: t("全员表决中"), description: t("等待房间成员完成对队伍的表决。") };
      return {
        title: t("任务 {quest} · 全员表决", { quest: game.quest }),
        description: t("所有人提交后，统一揭晓赞成与反对。"),
        progress: {
          value: game.votedSeats.length,
          max: room.capacity,
          label: t("组队表决"),
          detail: t("{done} / {total} 人已提交", { done: game.votedSeats.length, total: room.capacity }),
        },
      };
    case "quest":
      if (!game) return { title: t("任务进行中"), description: t("等待任务队员提交各自的秘密任务牌。") };
      return {
        title: t("任务 {quest} · 秘密投牌", { quest: game.quest }),
        description: t("任务牌收齐后，只公布失败牌的总数。"),
        progress: {
          value: game.submittedQuestCount,
          max: game.teamSize,
          label: t("任务投牌"),
          detail: t("{done} / {total} 张已提交", { done: game.submittedQuestCount, total: game.teamSize }),
        },
      };
    case "lake":
      return {
        title: t("湖中仙女查验中"),
        description: room.game?.lake ? t("令牌由 {seat} 号玩家持有，等待其私密查验阵营。", { seat: room.game.lake.holderSeat }) : t("等待湖中仙女完成查验。"),
      };
    case "assassination":
      return {
        title: t("最后的刺杀"),
        description: t("三次任务成功，等待刺客作出最终选择。"),
      };
    case "finished": {
      if (!game?.result) return { title: t("本局已结束"), description: t("房间成员可以查看本局结果与复盘记录。") };
      const descriptions = {
        "three-failures": t("三次任务失败，可以查看本局记录与身份。"),
        "five-rejections": t("连续五次组队被否决，可以查看本局记录与身份。"),
        "merlin-assassinated": t("梅林被刺中，可以查看本局记录与身份。"),
        "assassin-missed": t("梅林躲过刺杀，可以查看本局记录与身份。"),
      };
      return {
        title: game.result.winner === "good" ? t("正义阵营获胜") : t("邪恶阵营获胜"),
        description: descriptions[game.result.reason],
        tone: game.result.winner,
      };
    }
    case "closed":
      return { title: t("房间已关闭"), description: t("返回首页，创建或加入另一张圆桌。") };
  }
}

export function RoomProgress({ room, connected, live = false }: RoomProgressProps) {
  const { t } = useI18n();
  void connected;
  void live;
  const summary = stageSummary(room, t);
  const progress = summary.progress;
  if (!progress) return null;
  const value = Math.max(0, Math.min(progress.value, progress.max));

  return (
    <section className="room-progress room-progress-slim" aria-label={t("房间进度")}>
      <div className="room-progress-slim-row">
        <div
          className="room-progress-meter-track"
          role="progressbar"
          aria-label={`${value}/${progress.max}`}
          aria-valuemin={0}
          aria-valuemax={progress.max}
          aria-valuenow={value}
          aria-valuetext={`${value}/${progress.max}`}
        >
          <span style={{ width: `${progress.max > 0 ? value / progress.max * 100 : 0}%` }} />
        </div>
        <b>{value}/{progress.max}</b>
      </div>
    </section>
  );
}
