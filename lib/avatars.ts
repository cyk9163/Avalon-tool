export const AVATAR_IDS = ["crown", "shield", "sword", "lake", "star", "moon", "rose", "wolf"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}
