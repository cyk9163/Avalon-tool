// Translation coverage check.  node scripts/i18n-check.mjs [file ...]
// UI files: every Chinese text must sit inside t("…"), ts(…) input excluded,
// or msg("…"), and every such key needs an English entry.
// Server files: every Chinese string literal is a message the client may show;
// it needs an entry, with ${…} turned into {0}, {1}, … placeholders.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const UI_FILES = [
  "app/page.tsx", "app/layout.tsx", "app/admin/page.tsx", "app/rules/page.tsx", "app/privacy/page.tsx", "app/me/page.tsx", "app/solo/page.tsx",
  "components/action-dock.tsx", "components/device-recovery.tsx", "components/early-assassination.tsx", "components/player-notes.tsx", "components/room-section-nav.tsx", "components/game-table.tsx", "components/vote-matrix.tsx", "components/speech-bar.tsx", "components/reveal-overlay.tsx", "lib/turn.ts", "components/theme-toggle.tsx", "components/room-record.tsx", "components/big-screen.tsx", "app/screen/page.tsx", "components/role-info.tsx", "lib/role-info.ts", "lib/replay-image.ts", "lib/highlights.ts", "components/rules-card.tsx", "components/doc-page.tsx", "components/game-panel.tsx", "components/install-app.tsx", "components/avatar-face.tsx", "components/player-home.tsx", "components/settlement.tsx", "components/mvp-vote.tsx",
  "components/lang-toggle.tsx", "components/replay-export.tsx", "components/replay-timeline.tsx", "components/personal-record.tsx", "components/push-toggle.tsx", "components/seat-table.tsx", "components/help-dialog.tsx", "lib/room-client.ts", "components/room-management.tsx", "components/room-progress.tsx",
  "components/takeover-requests.tsx", "lib/replay.ts", "lib/board-templates.ts",
];
export const SERVER_FILES = [
  "lib/game.ts", "lib/game/model.ts", "lib/game/view.ts", "lib/game/play.ts", "lib/game/manage.ts", "lib/room-store.ts", "lib/push-store.ts", "lib/push-subscription.ts", "lib/request-context.ts", "lib/live-gateway.ts", "lib/room-hub.ts",
  "app/api/room/route.ts", "app/api/admin/route.ts", "app/api/profile/route.ts",
];
const CJK = /[㐀-鿿　-〿！-～]/;
const root = new URL("../", import.meta.url);

function stripComments(source) {
  // Line comments only when "//" is not inside a URL; block comments anywhere.
  return source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (match, lead) => lead + " ".repeat(match.length - lead.length));
}
const lineOf = (source, index) => source.slice(0, index).split("\n").length;

export async function check(files = [...UI_FILES, ...SERVER_FILES]) {
  const { EN, SOURCES } = await import("../lib/i18n/dictionary.ts");
  const problems = [];
  const used = new Set();
  const reported = new Set();
  for (const file of files) {
    let source = stripComments(readFileSync(new URL(file, root), "utf8"));
    if (UI_FILES.includes(file)) {
      const call = /\b(?:t|msg)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
      source = source.replace(call, (match, quote, key) => {
        if (CJK.test(key)) {
          if (quote === "`" && key.includes("${")) problems.push(`${file}: key uses \${} instead of {name}: ${key}`);
          used.add(key.replace(/\\(.)/g, "$1"));
        }
        return match.replace(key, "");
      });
      // native("…") is text deliberately shown in its own language (the language switch).
      source = source.replace(/\bnative\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g, "native()");
      source.split("\n").forEach((line, index) => { if (CJK.test(line)) problems.push(`${file}:${index + 1}: untranslated text: ${line.trim().slice(0, 90)}`); });
    } else if (SERVER_FILES.includes(file)) {
      const literal = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
      for (const match of source.matchAll(literal)) {
        const [, quote, body] = match;
        if (!CJK.test(body)) continue;
        let index = 0;
        const key = (quote === "`" ? body.replace(/\$\{[^}]*\}/g, () => `{${index++}}`) : body).replace(/\\(.)/g, "$1").trim();
        used.add(key);
        if (!Object.hasOwn(EN, key) && !reported.has(key)) { reported.add(key); problems.push(`${file}:${lineOf(source, match.index)}: no English entry for server text: ${key}`); }
      }
    }
  }
  for (const key of used) if (!Object.hasOwn(EN, key) && !reported.has(key)) { reported.add(key); problems.push(`missing English entry: ${key}`); }
  const seen = new Map();
  for (const [area, entries] of Object.entries(SOURCES)) {
    for (const [zh, en] of Object.entries(entries)) {
      if (CJK.test(en)) problems.push(`${area}: English entry still contains Chinese: ${zh} -> ${en}`);
      const holders = key => (key.match(/\{\w+\}/g) ?? []).sort().join(",");
      if (holders(zh) !== holders(en)) problems.push(`${area}: placeholders differ: ${zh} -> ${en}`);
      if (seen.has(zh) && seen.get(zh).en !== en) problems.push(`${area}: conflicts with ${seen.get(zh).area}: ${zh}`);
      seen.set(zh, { area, en });
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = await check(process.argv.slice(2).length ? process.argv.slice(2) : undefined);
  for (const problem of problems) console.log(problem);
  console.log(problems.length ? `${problems.length} problem(s)` : "i18n OK");
  process.exitCode = problems.length ? 1 : 0;
}
