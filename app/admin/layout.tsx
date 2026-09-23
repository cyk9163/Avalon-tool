import type { Metadata } from "next";
import { serverLang, serverT } from "@/lib/i18n/server";
import "./admin.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return {
    title: t("管理后台 · 圆桌"),
    description: t("圆桌运营统计（仅限管理员）。"),
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
