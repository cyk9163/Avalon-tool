import type { Metadata } from "next";
import "./globals.css";
import "./game.css";

export const metadata: Metadata = {
  title: "圆桌 · 阿瓦隆助手",
  description: "与朋友面对面玩阿瓦隆：扫码入座、私密身份、组队投票、匿名任务与整局复盘。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
