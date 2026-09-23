"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/react";

type BadgeNavigator = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * When it becomes this player's move (v1.8): prefix the tab title, give a
 * short buzz where phones allow it (Android), and set the home-screen badge
 * when the app is installed. Everything is cleared once the move is made.
 */
export function useTurnReminder(label: string | null) {
  const { t } = useI18n();
  const text = label ? t(label) : null;
  useEffect(() => {
    if (!text) return;
    const original = document.title;
    document.title = `● ${text} · ${original}`;
    const nav = navigator as BadgeNavigator;
    try { nav.vibrate?.(180); } catch { /* Not allowed before the first tap. */ }
    nav.setAppBadge?.(1).catch(() => undefined);
    return () => {
      document.title = original;
      nav.clearAppBadge?.().catch(() => undefined);
    };
  }, [text]);
}
