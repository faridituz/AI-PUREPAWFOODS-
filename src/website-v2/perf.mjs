import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const targets = [
  ["原型A 英文首页", "http://localhost:4173/a/en/"],
  ["原型A 俄语首页", "http://localhost:4173/a/ru/"],
  ["原型A 乌语首页", "http://localhost:4173/a/uz/"],
  ["原型A 产品页(俄)", "http://localhost:4173/a/ru/product/kitten-chicken/"],
  ["原型B 俄语首页", "http://localhost:4173/b/ru/"],
  ["原型B 联系表单页(俄)", "http://localhost:4173/b/ru/contact/"],
  ["原型C 俄语首页", "http://localhost:4173/c/ru/"],
  ["原型C 招商表单页(俄)", "http://localhost:4173/c/ru/partners/"],
  ["现有线上首页", "https://purepawfoods.com/"]
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=9334",
    `--user-data-dir=${path.resolve(__dirname, "../../data/temp/chrome-perf")}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9334/json/list")).json();
    const page = list.find((p) => p.type === "page");
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error("无法连接 Chrome"); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  connectionType: "cellular3g"
});
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = Math.max(window.__lcp, e.startTime); })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  `
});

console.log("移动端 390px + 模拟 3G（1.6Mbps / 150ms），清缓存，每页等待 7s");
console.log("| 页面 | FCP | LCP | CLS | HTML传输 | 请求数 | 总传输 |");
console.log("| :--- | ---: | ---: | ---: | ---: | ---: | ---: |");
const perfRows = [];

for (const [name, url] of targets) {
  await send("Page.navigate", { url });
  await sleep(7000);
  const { result } = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const res = performance.getEntriesByType('resource');
      const all = [nav, ...res];
      const bytes = all.reduce((s, r) => s + (r.transferSize || 0), 0);
      const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
      return {
        fcp: Math.round(fcp),
        lcp: Math.round(window.__lcp || 0),
        cls: +(window.__cls || 0).toFixed(3),
        htmlBytes: nav.transferSize || 0,
        requests: all.length,
        totalBytes: bytes
      };
    })()`
  });
  const v = result.value;
  perfRows.push({ page: name, url, ...v });
  console.log(`| ${name} | ${v.fcp} ms | ${v.lcp} ms | ${v.cls} | ${(v.htmlBytes / 1024).toFixed(1)} KB | ${v.requests} | ${(v.totalBytes / 1024).toFixed(1)} KB |`);
}

mkdirSync(path.resolve(__dirname, "../../output/evidence"), { recursive: true });
writeFileSync(
  path.resolve(__dirname, "../../output/evidence/perf.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), conditions: "390x844, 3G 1.6Mbps/150ms, cache disabled", rows: perfRows }, null, 2)
);

ws.close();
chrome.kill();
