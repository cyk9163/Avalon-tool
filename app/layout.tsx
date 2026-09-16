import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./game.css";
import "./pwa.css";
import "./management.css";

export const metadata: Metadata = {
  title: "圆桌 · 阿瓦隆助手",
  description: "与朋友面对面玩阿瓦隆：扫码入座、私密身份、组队投票、匿名任务与整局复盘。",
  applicationName: "圆桌 · 阿瓦隆助手",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "圆桌阿瓦隆",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101c22",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
