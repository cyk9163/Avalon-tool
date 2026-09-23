import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n/react";
import { serverLang, serverT } from "@/lib/i18n/server";
import { ThemeProvider } from "@/components/theme-toggle";
import { serverTheme } from "@/lib/theme-server";
import { THEME_COLORS } from "@/lib/theme";
import "./globals.css";
import "./game.css";
import "./pwa.css";
import "./management.css";
import "./progress.css";
import "./recovery.css";
import "./docs.css";
import "./mobile.css";
// v1.11: generated light theme (scripts/theme-light.mjs), then hand-tuned exceptions.
import "./theme-light.css";
import "./theme-light-tweaks.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return {
    title: t("圆桌 · 阿瓦隆助手"),
    description: t("与朋友面对面玩阿瓦隆：扫码入座、私密身份、组队投票、匿名任务与整局复盘。"),
    applicationName: t("圆桌 · 阿瓦隆助手"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: t("圆桌阿瓦隆"),
      statusBarStyle: "default",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page use the full screen on notched phones; CSS pads the safe areas.
  viewportFit: "cover",
  themeColor: THEME_COLORS.dark,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, theme] = await Promise.all([serverLang(), serverTheme()]);
  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} data-theme={theme === "light" ? "light" : undefined}>
      <body className="antialiased"><I18nProvider initial={lang}><ThemeProvider initial={theme}>{children}</ThemeProvider></I18nProvider></body>
    </html>
  );
}
