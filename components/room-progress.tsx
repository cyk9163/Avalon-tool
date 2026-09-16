import { Check } from "lucide-react";
import type { RoomView } from "@/lib/game";

type RoomProgressProps = {
  room: RoomView;
  connected: boolean;
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

const steps = ["入座", "身份", "对局", "复盘"];

function currentStep(phase: RoomView["phase"]): number {
  if (phase === "lobby") return 0;
  if (phase === "identity" || phase === "ready") return 1;
  if (phase === "finished") return 3;
  if (phase === "closed") return -1;
  return 2;
}

function stageSummary(room: RoomView): StageSummary {
  const game = room.game;
  const ready = room.players.filter(player => player.ready).length;
  const confirmed = room.players.filter(player => player.confirmed).length;

  switch (room.phase) {
    case "lobby":
      return {
        title: room.players.length < room.capacity
          ? "等待朋友入座"
          : ready === room.capacity ? "等待房主发身份" : "人已到齐，准备开局",
        description: "入座后确认准备，房主将统一分配身份。",
        progress: {
          value: ready,
          max: room.capacity,
          label: "准备进度",
          detail: `入座 ${room.players.length} / ${room.capacity} · 准备 ${ready} / ${room.capacity}`,
        },
      };
    case "identity":
      return {
        title: "身份确认中",
        description: "各自查看秘密身份，全员确认后进入对局。",
        progress: {
          value: confirmed,
          max: room.capacity,
          label: "身份确认",
          detail: `${confirmed} / ${room.capacity} 人已确认`,
        },
      };
    case "ready":
      return {
        title: "全员就绪",
        description: "等待房主开始第一轮任务。",
        progress: {
          value: room.capacity,
          max: room.capacity,
          label: "身份确认",
          detail: "全员已确认",
        },
      };
    case "team": {
      if (!game) return { title: "队长正在选队", description: "房间成员正在讨论本次任务的队伍。" };
      const leader = room.players.find(player => player.seat === game.leaderSeat);
      return {
        title: `任务 ${game.quest} · 等待选队`,
        description: `队长 ${game.leaderSeat} 号 · ${leader?.name ?? "玩家"}，本次需选 ${game.teamSize} 人。`,
      };
    }
    case "vote":
      if (!game) return { title: "全员表决中", description: "等待房间成员完成对队伍的表决。" };
      return {
        title: `任务 ${game.quest} · 全员表决`,
        description: "所有人提交后，统一揭晓赞成与反对。",
        progress: {
          value: game.votedSeats.length,
          max: room.capacity,
          label: "组队表决",
          detail: `${game.votedSeats.length} / ${room.capacity} 人已提交`,
        },
      };
    case "quest":
      if (!game) return { title: "任务进行中", description: "等待任务队员提交各自的秘密任务牌。" };
      return {
        title: `任务 ${game.quest} · 秘密投牌`,
        description: "任务牌收齐后，只公布失败牌的总数。",
        progress: {
          value: game.submittedQuestCount,
          max: game.teamSize,
          label: "任务投牌",
          detail: `${game.submittedQuestCount} / ${game.teamSize} 张已提交`,
        },
      };
    case "assassination":
      return {
        title: "最后的刺杀",
        description: "三次任务成功，等待刺客作出最终选择。",
      };
    case "finished": {
      if (!game?.result) return { title: "本局已结束", description: "房间成员可以查看本局结果与复盘记录。" };
      const descriptions = {
        "three-failures": "三次任务失败，可以查看本局记录与身份。",
        "five-rejections": "连续五次组队被否决，可以查看本局记录与身份。",
        "merlin-assassinated": "梅林被刺中，可以查看本局记录与身份。",
        "assassin-missed": "梅林躲过刺杀，可以查看本局记录与身份。",
      };
      return {
        title: game.result.winner === "good" ? "正义阵营获胜" : "邪恶阵营获胜",
        description: descriptions[game.result.reason],
        tone: game.result.winner,
      };
    }
    case "closed":
      return { title: "房间已关闭", description: "返回首页，创建或加入另一张圆桌。" };
  }
}

export function RoomProgress({ room, connected }: RoomProgressProps) {
  const activeStep = currentStep(room.phase);
  const summary = stageSummary(room);
  const progress = summary.progress;
  const value = progress ? Math.max(0, Math.min(progress.value, progress.max)) : 0;

  return (
    <section className={`room-progress${room.game ? " room-progress--playing" : ""}${summary.tone ? ` room-progress--${summary.tone}` : ""}`} aria-label="房间进度">
      <div className="room-progress-topline">
        <ol className="room-progress-steps" aria-label="对局阶段">
          {steps.map((label, index) => (
            <li
              key={label}
              className={index === activeStep ? "is-current" : index < activeStep ? "is-complete" : undefined}
              aria-current={index === activeStep ? "step" : undefined}
            >
              <span className="room-progress-step-number" aria-hidden="true">
                {index < activeStep ? <Check size={12} strokeWidth={2} /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <span className={`room-progress-connection${connected ? "" : " is-reconnecting"}`} role="status">
          <span aria-hidden="true" />
          {connected ? "已同步" : "重连中"}
        </span>
      </div>

      <div className="room-progress-summary" aria-live="polite" aria-atomic="true">
        <h2>{summary.title}</h2>
        <p>{summary.description}</p>
        {progress && (
          <div className="room-progress-meter">
            <div className="room-progress-meter-caption">
              <span>{progress.label}</span>
              <span>{progress.detail}</span>
            </div>
            <div
              className="room-progress-meter-track"
              role="progressbar"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuemax={progress.max}
              aria-valuenow={value}
              aria-valuetext={progress.detail}
            >
              <span style={{ width: `${progress.max > 0 ? value / progress.max * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
