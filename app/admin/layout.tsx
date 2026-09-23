import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "管理后台 · 圆桌",
  description: "圆桌运营统计（仅限管理员）。",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
