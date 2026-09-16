import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "圆桌 · 阿瓦隆助手",
  description: "与朋友面对面玩阿瓦隆：扫码入座，私密查看身份。",
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
