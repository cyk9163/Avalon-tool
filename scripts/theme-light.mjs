// Generates app/theme-light.css (v1.11): the light theme as overrides of every
// colour in the app's own stylesheets, scoped to :root[data-theme="light"].
// Each colour keeps its hue but flips its lightness in OKLab, so dark
// surfaces become light and light text becomes dark; accents turn into
// darker shades that stay readable on a light background. Hand-tuned
// exceptions live in app/theme-light-tweaks.css.
//   node scripts/theme-light.mjs          write the file
//   node scripts/theme-light.mjs --check  exit 1 if the file is out of date
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const SOURCES = ["globals", "game", "pwa", "management", "progress", "recovery", "docs", "mobile"].map(name => `app/${name}.css`);
const OUTPUT = "app/theme-light.css";
const SCOPE = ':root[data-theme="light"]';
const HEX = /#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
const SHADOW_PROPS = new Set(["box-shadow", "text-shadow", "filter"]);
const COLOR_PROP = /^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration(-color)?|--[\w-]+)$/;
// The home page's create/join card is already a light card.
const LIGHT_CARD = ["entry-", ".field", "legend", ".count-", ".preset-", ".custom-board", ".custom-role", ".template-", ".module-toggle", ".host-key", ".join-intro"];

const toLinear = value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const toGamma = value => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

function parseHex(hex) {
  let digits = hex.slice(1).toLowerCase();
  if (digits.length <= 4) digits = [...digits].map(digit => digit + digit).join("");
  const channel = index => parseInt(digits.slice(index, index + 2), 16) / 255;
  return { r: channel(0), g: channel(2), b: channel(4), alpha: digits.length === 8 ? digits.slice(6) : "" };
}

function toOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function fromOklab({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return rgb.map(value => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, value))))) * 255));
}

/** Dark surfaces → very light; mid tones (borders) → light grey; light text and accents → dark. */
export function flipLightness(L) {
  const steps = [[0, 0.99], [0.2, 0.965], [0.5, 0.8], [0.7, 0.45], [1, 0.2]];
  for (let index = 1; index < steps.length; index++) {
    const [x0, y0] = steps[index - 1], [x1, y1] = steps[index];
    if (L <= x1) return y0 + (y1 - y0) * (Math.max(L, x0) - x0) / (x1 - x0);
  }
  return steps.at(-1)[1];
}

export function lightColor(hex, prop = "color") {
  const color = parseHex(hex);
  const lab = toOklab(color);
  // A dark translucent shadow stays a (softer) dark shadow.
  if (SHADOW_PROPS.has(prop) && lab.L < 0.15 && color.alpha) {
    return `#000000${Math.round(parseInt(color.alpha, 16) * 0.5).toString(16).padStart(2, "0")}`;
  }
  const chroma = Math.hypot(lab.a, lab.b);
  let L = flipLightness(lab.L), scale = 1;
  if (lab.L < 0.5) scale = 0.3;                         // dark tinted surfaces → nearly neutral light ones
  else if (lab.L >= 0.6 && chroma >= 0.04) { L = Math.max(L, 0.45); scale = 1.1; }  // accents keep their colour
  const [r, g, b] = fromOklab({ L, a: lab.a * scale, b: lab.b * scale });
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}${color.alpha}`;
}

function scoped(selector) {
  if (selector.startsWith(":root")) return SCOPE + selector.slice(5);
  if (selector.startsWith("html")) return `html[data-theme="light"]${selector.slice(4)}`;
  return `${SCOPE} ${selector}`;
}

export function buildLightTheme() {
  const out = postcss.root();
  for (const file of SOURCES) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkComments(comment => comment.remove());
    root.walkAtRules(rule => {
      if (["import", "theme", "keyframes", "font-face", "custom-variant", "plugin"].includes(rule.name)) rule.remove();
      else if (rule.name === "layer") rule.replaceWith(rule.nodes ?? []);
    });
    root.walkRules(rule => {
      // The home page's create/join card is already a light card: its rules stay as they are.
      if (rule.selectors.some(selector => LIGHT_CARD.some(key => selector.includes(key)))) { rule.remove(); return; }
      rule.walkDecls(decl => {
        HEX.lastIndex = 0;
        if (decl.prop === "color-scheme") { decl.value = "light"; return; }
        // Every colour declaration is copied (var() and keywords unchanged), not
        // just hex ones: the scope raises specificity for all of them alike, so
        // the cascade between rules stays exactly as in the dark theme.
        if (!HEX.test(decl.value) && !COLOR_PROP.test(decl.prop)) { decl.remove(); return; }
        decl.value = decl.value.replace(HEX, match => lightColor(match, decl.prop));
      });
      if (!rule.nodes.length) rule.remove();
      else rule.selectors = rule.selectors.map(scoped);
    });
    let changed = true;
    while (changed) {
      changed = false;
      root.walkAtRules(rule => { if (!rule.nodes?.length) { rule.remove(); changed = true; } });
    }
    out.append(postcss.comment({ text: `from ${file}` }), root.nodes);
  }
  return `/* Generated by scripts/theme-light.mjs from the app stylesheets. Do not edit by hand. */\n${out.toResult().css.trim()}\n`;
}

if (process.argv[1]?.endsWith("theme-light.mjs")) {
  const css = buildLightTheme();
  if (process.argv.includes("--check")) {
    // Windows checkouts may turn line endings into CRLF.
    if (readFileSync(OUTPUT, "utf8").replace(/\r\n/g, "\n") !== css) { console.error(`${OUTPUT} is out of date: run npm run theme:build`); process.exit(1); }
    console.log(`${OUTPUT} is up to date`);
  } else {
    writeFileSync(OUTPUT, css);
    console.log(`wrote ${OUTPUT} (${css.length} bytes)`);
  }
}
