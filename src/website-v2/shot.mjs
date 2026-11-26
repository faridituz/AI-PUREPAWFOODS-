import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [url, width = "390", height = "844", out = "output/prototypes/evidence/shot.png"] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=9335", `--user-data-dir=${path.resolve(__dirname, "../../data/temp/chrome-shot")}`, "about:blank"],
  { stdio: "ignore" }
);

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9335/json/list")).json();
    const page = list.find((p) => p.type === "page");
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
}
if (!wsUrl) {
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
await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(height), deviceScaleFactor: 2, mobile: Number(width) < 600 });
await send("Page.navigate", { url });
await sleep(600);
const { data } = await send("Page.captureScreenshot", { format: "png" });
const file = path.resolve(__dirname, "../..", out);
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, Buffer.from(data, "base64"));
console.log(file);
ws.close();
chrome.kill();
