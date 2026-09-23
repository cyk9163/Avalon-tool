"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { RoomView } from "@/lib/game";
import { useI18n } from "@/lib/i18n/react";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid-public";

type Act = (action: string, input?: Record<string, unknown>) => Promise<RoomView | null>;

function applicationServerKey() {
  const padded = VAPID_PUBLIC_KEY.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - VAPID_PUBLIC_KEY.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function iosBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
}

/** Opt-in lock-screen reminder. Permission is requested only from this click. */
export function PushToggle({ seated, act }: { seated: boolean; act: Act }) {
  const { t, lang } = useI18n();
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!seated) return null;

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage(t("这台浏览器不支持锁屏提醒。"));
      return;
    }
    if (iosBrowser() && !standalone()) {
      setMessage(t("iPhone 请先把圆桌添加到主屏幕，系统为 iOS 16.4 或更新，再开启锁屏提醒。"));
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage(t("需要允许通知，才能在锁屏时提醒你。"));
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const ready = await navigator.serviceWorker.ready;
    const subscription = await (registration.pushManager ?? ready.pushManager).subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(),
    });
    const json = subscription.toJSON();
    const saved = await act("push-subscribe", {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      lang,
    });
    if (!saved) {
      await subscription.unsubscribe().catch(() => undefined);
      setMessage(t("锁屏提醒暂时没能开启，请稍后再试。"));
      return;
    }
    setOn(true);
    setMessage(t("锁屏提醒已开启。轮到你时会收到一条不含身份的通知。"));
  }

  async function disable() {
    const registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => undefined);
    await act("push-unsubscribe");
    setOn(false);
    setMessage(t("锁屏提醒已关闭。"));
  }

  return <>
    <button type="button" className="icon-button" aria-pressed={on} disabled={busy} aria-label={on ? t("关闭锁屏提醒") : t("开启锁屏提醒")} onClick={async () => {
      setBusy(true);
      try { await (on ? disable() : enable()); }
      catch { setMessage(t("锁屏提醒暂时没能开启，请稍后再试。")); }
      finally { setBusy(false); }
    }}>{on ? <BellOff size={18} /> : <Bell size={18} />}</button>
    {message && <p className="push-note" role="status">{message}</p>}
  </>;
}
