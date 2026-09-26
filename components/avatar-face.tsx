"use client";

import { Crown, Flower2, Moon, PawPrint, Shield, Star, Swords, Waves } from "lucide-react";
import { AVATAR_IDS, type AvatarId } from "@/lib/avatars";

const ICONS: Record<AvatarId, typeof Crown> = {
  crown: Crown,
  shield: Shield,
  sword: Swords,
  lake: Waves,
  star: Star,
  moon: Moon,
  rose: Flower2,
  wolf: PawPrint,
};

export function avatarName(t: (zh: string) => string, id: string): string {
  if (id === "crown") return t("王冠");
  if (id === "shield") return t("盾牌");
  if (id === "sword") return t("长剑");
  if (id === "lake") return t("湖水");
  if (id === "star") return t("星辰");
  if (id === "moon") return t("月亮");
  if (id === "rose") return t("玫瑰");
  if (id === "wolf") return t("孤狼");
  return "";
}

export function AvatarFace({ id, size = 18 }: { id?: string | null; size?: number }) {
  if (!id || !(id in ICONS)) return null;
  const Icon = ICONS[id as AvatarId];
  return <span className={`avatar-face is-${id}`}><Icon size={size} aria-hidden="true" /></span>;
}

export { AVATAR_IDS };
