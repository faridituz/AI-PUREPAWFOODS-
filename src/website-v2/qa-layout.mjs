import { spawn, execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = args.find((a) => a.startsWith("http")) || "http://localhost:4173";
const THEMES = getArg("--themes", "a,b,c,d").split(",").filter(Boolean);
const LANGS = JSON.parse(readFileSync(path.join(__dirname, "content/languages.json"), "utf-8"))
  .languages.filter((l) => l.enabled)
  .map((l) => l.code);

// 120 组合复测：8 语言 × 5 页面 × 3 断点；
// 追加 320/360/412/1920 只测关键页（首页 + 产品页），避免无意义膨胀。
const CORE_VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "desktop-1440", width: 1440, height: 1000, mobile: false }
];
const EXTRA_VIEWPORTS = [
  { name: "narrow-320", width: 320, height: 720, mobile: true },
  { name: "narrow-360", width: 360, height: 800, mobile: true },
  { name: "android-412", width: 412, height: 915, mobile: true },
  { name: "wide-1920", width: 1920, height: 1080, mobile: false }
];
const CORE_PAGES = ["", "cat", "product/kitten-chicken", "partners", "contact"];
const EXTRA_PAGES = ["", "product/kitten-chicken"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gitHead = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: path.resolve(__dirname, "../.."), encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
})();

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=9333",
    `--user-data-dir=${path.resolve(__dirname, "../../data/temp/chrome-qa")}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
    const page = list.find((p) => p.type === "page");
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
}
if (!wsUrl) {
  console.error("无法连接 Chrome 调试端口");
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = (expression) =>
  send("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression }).then((r) => r.result.value);

await send("Page.enable");
await send("Runtime.enable");

const rows = [];
let failures = 0;

async function checkPage(theme, vp, lang, rel) {
  const url = `${BASE}/${theme}/${lang}/${rel ? rel + "/" : ""}`;
  await send("Page.navigate", { url });
  await sleep(280);
  const v = await evaluate(`(() => {
    const vw = innerWidth;
    const doc = document.documentElement;
    const offenders = [...document.querySelectorAll('body *')]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > vw + 1 || r.left < -1))
      .slice(0, 5)
      .map(({ el, r }) => el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ').filter(Boolean).join('.') + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    const text = document.body.innerText || '';
    const alts = [...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => ({ h: l.hreflang, href: l.href }));
    const switchLinks = [...document.querySelectorAll('.lang-menu a')].map(a => ({ lang: a.getAttribute('lang'), href: a.getAttribute('href') }));
    return {
      vw,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > vw + 1,
      offenders,
      lang: doc.lang,
      dir: doc.dir,
      hreflang: alts.length,
      alts,
      canonical: !!document.querySelector('link[rel=canonical]'),
      noindex: !!document.querySelector('meta[name=robots][content*=noindex]'),
      title: document.title,
      description: (document.querySelector('meta[name=description]') || {}).content || '',
      cjk: /[\\u4e00-\\u9fff]/.test(text),
      arabic: /[\\u0600-\\u06ff]/.test(text),
      cyrillic: /[\\u0400-\\u04ff]/.test(text),
      switchCount: switchLinks.length,
      switchLinks,
      forms: document.querySelectorAll('form[data-lead-form]').length,
      h1: document.querySelectorAll('h1').length
    };
  })()`);

  const reasons = [];
  if (v.overflow) reasons.push("overflow");
  if (v.lang !== lang) reasons.push("html-lang");
  if (v.hreflang !== LANGS.length + 1) reasons.push("hreflang-count");
  if (!v.canonical) reasons.push("canonical");
  if (!v.noindex) reasons.push("noindex");
  if (lang !== "zh" && v.cjk) reasons.push("cjk-leak");
  if (lang === "ar" && !v.arabic) reasons.push("arabic-missing");
  if (["ru", "kk", "ky", "tg"].includes(lang) && !v.cyrillic) reasons.push("cyrillic-missing");
  if (v.dir !== (lang === "ar" ? "rtl" : "ltr")) reasons.push("dir");
  if (!v.title) reasons.push("title");
  if (!v.description) reasons.push("description");
  if (v.switchCount !== LANGS.length) reasons.push("switch-count");
  if (v.h1 !== 1) reasons.push("h1-count");
  const expectForms = rel === "contact" || rel === "partners" || rel === "" ? 1 : 0;
  if (theme !== "a" && rel === "" && v.forms !== 1) reasons.push("home-form");
  if (rel === "contact" && v.forms !== 1) reasons.push("contact-form");
  if (rel === "partners" && v.forms !== 1) reasons.push("partner-form");
  if (theme === "a" && rel === "" && v.forms !== 0) reasons.push("unexpected-form");

  // 每个语言切换链接必须指向同一相对路径，且只包含已启用语言
  const relPath = rel ? `/${rel}/` : "/";
  for (const link of v.switchLinks) {
    if (!link.href || !link.href.endsWith(relPath)) reasons.push("switch-target");
    if (!LANGS.includes(link.lang)) reasons.push("switch-lang");
  }
  // hreflang 必须覆盖 8 语言 + x-default，且 URL 以语言路径结尾
  const altLangs = v.alts.map((a) => a.h);
  for (const code of [...LANGS, "x-default"]) {
    if (!altLangs.includes(code)) reasons.push("hreflang-" + code);
  }
  for (const alt of v.alts) {
    const code = alt.h === "x-default" ? "en" : alt.h;
    if (!alt.href.includes(`/${code}/`)) reasons.push("hreflang-url-" + alt.h);
  }

  if (reasons.length) failures++;
  rows.push({
    theme,
    breakpoint: vp.name,
    width: vp.width,
    lang,
    page: rel || "home",
    scrollWidth: v.scrollWidth,
    vw: v.vw,
    dir: v.dir,
    hreflang: v.hreflang,
    switchCount: v.switchCount,
    forms: v.forms,
    title: v.title,
    problems: [...new Set(reasons)],
    offenders: v.offenders
  });
  if (v.overflow) {
    console.log(`OVERFLOW ${theme} ${vp.name} ${lang}/${rel || "home"}: ${v.scrollWidth}px > ${v.vw}px -> ${v.offenders.join(" | ")}`);
  }
  return v;
}

const startedAt = new Date().toISOString();
for (const theme of THEMES) {
  for (const vp of CORE_VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
    for (const lang of LANGS) for (const rel of CORE_PAGES) await checkPage(theme, vp, lang, rel);
  }
  for (const vp of EXTRA_VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
    for (const lang of LANGS) for (const rel of EXTRA_PAGES) await checkPage(theme, vp, lang, rel);
  }
  console.log(`主题 ${theme.toUpperCase()} 检查完成：${rows.filter((r) => r.theme === theme).length} 组合`);
}

// 交互抽检：语言切换保持当前页面 + 浏览器后退
const interaction = [];
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
for (const theme of THEMES) {
  await send("Page.navigate", { url: `${BASE}/${theme}/en/product/kitten-chicken/` });
  await sleep(300);
  const clicked = await evaluate(`(() => {
    const link = document.querySelector('.lang-menu a[lang="ru"]');
    if (!link) return false;
    link.click();
    return true;
  })()`);
  await sleep(350);
  const afterSwitch = await evaluate("location.pathname");
  interaction.push({ theme, test: "switch-keeps-product", clicked, path: afterSwitch, pass: /\/ru\/product\/kitten-chicken\/$/.test(afterSwitch) });

  await send("Page.navigate", { url: `${BASE}/${theme}/ru/` });
  await sleep(300);
  await send("Page.navigate", { url: `${BASE}/${theme}/ru/cat/` });
  await sleep(300);
  await evaluate("history.back()");
  await sleep(400);
  const afterBack = await evaluate("location.pathname");
  interaction.push({ theme, test: "browser-back", path: afterBack, pass: /\/ru\/$/.test(afterBack) });
}
for (const item of interaction) if (!item.pass) failures++;
console.log("交互抽检:", interaction.map((i) => `${i.theme}:${i.test}=${i.pass ? "通过" : "失败"}`).join(" | "));

const evidenceDir = path.resolve(__dirname, "../../output/evidence");
mkdirSync(evidenceDir, { recursive: true });
const report = {
  generatedAt: startedAt,
  finishedAt: new Date().toISOString(),
  gitHead,
  base: BASE,
  themes: THEMES,
  langs: LANGS,
  viewports: [...CORE_VIEWPORTS, ...EXTRA_VIEWPORTS].map((v) => `${v.name} ${v.width}px`),
  total: rows.length,
  failures,
  interaction,
  rows
};
writeFileSync(path.join(evidenceDir, "qa-layout.json"), JSON.stringify(report, null, 2));

const byProblem = {};
for (const row of rows) for (const p of row.problems) byProblem[p] = (byProblem[p] || 0) + 1;
console.log("=== 汇总 ===");
console.log(`组合 ${rows.length} 个（含 320/360/412/1920 关键页），异常 ${failures} 个`);
console.log("问题分布:", JSON.stringify(byProblem));
console.log("日志 -> output/evidence/qa-layout.json");

if (args.includes("--shot")) {
  const shotDir = path.resolve(__dirname, "../../output/prototypes/evidence");
  mkdirSync(shotDir, { recursive: true });
  for (const theme of THEMES) {
    const shots = [
      ["uz", "", 390, 844, "home-390"],
      ["en", "product/kitten-chicken", 1440, 1000, "product-1440"],
      ["ar", "", 390, 844, "home-ar-390"],
      ["en", "contact", 1440, 1000, "contact-1440"]
    ];
    for (const [lang, rel, width, height, label] of shots) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: width < 600 });
      await send("Page.navigate", { url: `${BASE}/${theme}/${lang}/${rel ? rel + "/" : ""}` });
      await sleep(450);
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      const file = path.join(shotDir, `${theme}-${label}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log("截图:", file);
    }
  }
}

ws.close();
chrome.kill();
process.exit(failures ? 2 : 0);
