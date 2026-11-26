import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.argv[2] || "https://purepawfoods.com/";
const OUT = path.resolve(__dirname, "../../output/evidence/live-langs");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const LANGS = ["en", "zh", "ru", "ar", "uz", "kk", "ky", "tg"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=9337", `--user-data-dir=${path.resolve(__dirname, "../../data/temp/chrome-langs")}`, "about:blank"],
  { stdio: "ignore" }
);

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9337/json/list")).json();
    const page = list.find((p) => p.type === "page");
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { chrome.kill(); throw new Error("Chrome 调试端口未就绪"); }

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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL_ });
await sleep(2500);

const doc = await evalJs(`({ url: location.href, htmlLang: document.documentElement.lang, title: document.title })`);
const results = [];
for (const code of LANGS) {
  const info = await evalJs(`(async () => {
    const id = "pp-${code}";
    const input = document.getElementById(id);
    if (!input) return { found: false };
    input.click();
    await new Promise(r => setTimeout(r, 400));
    const panel = document.querySelector(".panel-${code}");
    const r = panel.getBoundingClientRect();
    const h2s = [...panel.querySelectorAll("h2")].map(h => h.textContent.trim());
    return {
      found: true,
      checked: input.checked,
      lang: panel.getAttribute("lang"),
      dir: panel.getAttribute("dir"),
      width: Math.round(r.width),
      height: Math.round(r.height),
      top: Math.round(r.top + scrollY),
      heading: h2s[0] || "",
      headings: h2s
    };
  })()`);
  if (!info.found) { results.push({ code, found: false }); continue; }
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: info.top, width: 1440, height: Math.min(info.height, 4000), scale: 1 }
  });
  const file = path.join(OUT, `${code}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  results.push({ code, ...info, file: path.relative(path.resolve(__dirname, "../.."), file) });
  console.log(`${code} ${info.checked ? "OK" : "未切换"} ${info.heading.slice(0, 40)} -> ${file}`);
}

const full = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(path.join(OUT, "page-top.png"), Buffer.from(full.data, "base64"));

writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ checkedAt: new Date().toISOString(), url: URL_, doc, langs: results }, null, 2),
  "utf-8"
);
console.log(`截图 ${results.filter((r) => r.found).length}/8 -> ${OUT}`);
ws.close();
chrome.kill();
