import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = args.find((a) => a.startsWith("http")) || "http://localhost:4173";
const LANGS = ["en", "zh", "ru", "ar", "uz", "kk", "ky", "tg"];
const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "desktop-1440", width: 1440, height: 1000, mobile: false }
];
const PAGES = ["", "cat", "product/kitten-chicken", "partners", "contact"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

await send("Page.enable");
await send("Runtime.enable");

const rows = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile
  });
  for (const lang of LANGS) {
    for (const rel of PAGES) {
      const url = `${BASE}/a/${lang}/${rel ? rel + "/" : ""}`;
      await send("Page.navigate", { url });
      await sleep(350);
      const { result } = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const vw = innerWidth;
          const doc = document.documentElement;
          const offenders = [...document.querySelectorAll('body *')]
            .map(el => { const r = el.getBoundingClientRect(); return { el, r }; })
            .filter(({ r }) => r.width > 0 && (r.right > vw + 1 || r.left < -1))
            .slice(0, 6)
            .map(({ el, r }) => el.tagName.toLowerCase() + '.' + (el.className && typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).join('.') : '') + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
          const html = document.documentElement;
          const text = document.body.innerText || '';
          return {
            vw,
            scrollWidth: doc.scrollWidth,
            overflow: doc.scrollWidth > vw + 1,
            offenders,
            lang: html.lang,
            dir: html.dir,
            hreflang: document.querySelectorAll('link[rel=alternate][hreflang]').length,
            canonical: !!document.querySelector('link[rel=canonical]'),
            noindex: !!document.querySelector('meta[name=robots][content*=noindex]'),
            cjk: /[\\u4e00-\\u9fff]/.test(text),
            title: document.title
          };
        })()`
      });
      const v = result.value;
      const bad = v.overflow || v.lang !== lang || v.hreflang !== 9 || !v.canonical || !v.noindex || (lang !== "zh" && v.cjk);
      if (bad) failures++;
      rows.push({ vp: vp.name, lang, page: rel || "home", ...v, bad });
      if (v.overflow) console.log(`OVERFLOW ${vp.name} ${lang}/${rel || "home"}: ${v.scrollWidth}px > ${v.vw}px -> ${v.offenders.join(" | ")}`);
    }
  }
}

const summary = {};
for (const r of rows) summary[r.vp] = (summary[r.vp] || 0) + (r.overflow ? 1 : 0);
console.log("=== 汇总 ===");
console.log(`检查 ${rows.length} 个组合，异常 ${failures} 个`);
console.log("横向溢出数（按断点）:", summary);
console.log("语言/方向抽检:", [...new Set(rows.map((r) => `${r.lang}:${r.dir}`))].join(", "));

if (args.includes("--shot")) {
  const shotDir = path.resolve(__dirname, "../../output/prototypes/evidence");
  mkdirSync(shotDir, { recursive: true });
  const shots = [
    ["uz", "", 390, 844],
    ["en", "product/kitten-chicken", 390, 844],
    ["ar", "", 390, 844]
  ];
  for (const [lang, rel, width, height] of shots) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: `${BASE}/a/${lang}/${rel ? rel + "/" : ""}` });
    await sleep(400);
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const file = path.join(shotDir, `a-${lang}-${rel ? rel.replace(/\//g, "-") : "home"}-390.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log("截图:", file);
  }
}

ws.close();
chrome.kill();
process.exit(failures ? 2 : 0);
