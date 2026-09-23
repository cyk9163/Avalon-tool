import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import type { ReactNode } from "react";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { serverLang, serverT } from "@/lib/i18n/server";

/** Shared frame for the server-rendered reading pages (rules, privacy). */
export async function DocPage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: ReactNode; children: ReactNode }) {
  const t = serverT(await serverLang());
  return (
    <main className="app-shell doc-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label={t("圆桌首页")}>
          <span className="brand-icon"><Crown size={22} /></span>
          <span>{t("圆桌")}<span className="brand-sub">AVALON</span></span>
        </Link>
        <div className="doc-actions">
          <ThemeToggle /><LangToggle reload />
          <Link className="doc-back" href="/"><ArrowLeft size={16} />{t("返回圆桌")}</Link>
        </div>
      </header>
      <article className="doc">
        <header className="doc-head">
          <span className="doc-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="doc-lead">{lead}</p>
        </header>
        {children}
      </article>
      <DocFooter />
    </main>
  );
}

export async function DocFooter() {
  const t = serverT(await serverLang());
  return (
    <footer className="page-footer doc-footer">
      <span className="footer-brand"><Crown size={14} />{t("把推理留在圆桌。")}</span>
      <nav className="footer-links" aria-label={t("站点信息")}>
        <Link href="/rules">{t("规则教学")}</Link>
        <Link href="/me">{t("我的战绩")}</Link>
        <Link href="/privacy">{t("隐私说明")}</Link>
      </nav>
    </footer>
  );
}

/** Horizontal-scroll wrapper so wide tables never widen the page on phones. */
export function DocTable({ caption, children }: { caption: string; children: ReactNode }) {
  return <div className="doc-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="doc-table"><caption>{caption}</caption>{children}</table></div>;
}
