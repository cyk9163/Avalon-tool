import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import type { ReactNode } from "react";

/** Shared frame for the static reading pages (rules, privacy). */
export function DocPage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <main className="app-shell doc-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="圆桌首页">
          <span className="brand-icon"><Crown size={22} /></span>
          <span>圆桌<span className="brand-sub">AVALON</span></span>
        </Link>
        <Link className="doc-back" href="/"><ArrowLeft size={16} />返回圆桌</Link>
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

export function DocFooter() {
  return (
    <footer className="page-footer doc-footer">
      <span className="footer-brand"><Crown size={14} />把推理留在圆桌。</span>
      <nav className="footer-links" aria-label="站点信息">
        <Link href="/rules">规则教学</Link>
        <Link href="/privacy">隐私说明</Link>
      </nav>
    </footer>
  );
}

/** Horizontal-scroll wrapper so wide tables never widen the page on phones. */
export function DocTable({ caption, children }: { caption: string; children: ReactNode }) {
  return <div className="doc-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="doc-table"><caption>{caption}</caption>{children}</table></div>;
}
