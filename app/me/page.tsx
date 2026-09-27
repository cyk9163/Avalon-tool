import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { PersonalRecord } from "@/components/personal-record";
import { serverLang, serverT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return {
    title: t("我的战绩 · 圆桌"),
    description: t("这台设备只记下没有登录时的结局。登录后的对局在首页「历史战绩」。"),
  };
}

export default async function MePage() {
  const t = serverT(await serverLang());
  return (
    <DocPage
      eyebrow="On this device"
      title={t("我的战绩")}
      lead={t("这台设备只记下没有登录时的结局。登录后的对局在首页「历史战绩」。")}
    >
      <PersonalRecord />
    </DocPage>
  );
}
