import type { Metadata } from "next";
import { BigScreen } from "@/components/big-screen";
import { serverLang, serverT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return { title: t("大屏模式 · 圆桌"), robots: { index: false, follow: false } };
}

/** Public big-screen view of one room (v1.10); see components/big-screen.tsx. */
export default function ScreenPage() {
  return <BigScreen />;
}
