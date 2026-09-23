import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { PersonalRecord } from "@/components/personal-record";
import { serverLang, serverT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return {
    title: t("我的战绩 · 圆桌"),
    description: t("只记在这台设备上：总胜率、各角色和各阵营的胜率、当梅林被刺中的次数，以及最近 10 局。不会上传。"),
  };
}

export default async function MePage() {
  const t = serverT(await serverLang());
  return (
    <DocPage
      eyebrow="On this device"
      title={t("我的战绩")}
      lead={t("只记在这台设备上：总胜率、各角色和各阵营的胜率、当梅林被刺中的次数，以及最近 10 局。不会上传。")}
    >
      <PersonalRecord />
    </DocPage>
  );
}
