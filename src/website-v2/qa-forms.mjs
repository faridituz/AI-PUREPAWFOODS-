import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const API_PORT = 4174;
const API = `http://localhost:${API_PORT}`;
// 浏览器用例独立起 STRESS 服务，避免正常限流（5/分钟）把 9 次提交拦掉
const UI_PORT = 4175;
const UI_BASE = `http://localhost:${UI_PORT}`;
const LEAD_FILE = path.join(ROOT, "data/mock-leads/leads.jsonl");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "通过" : "失败"}  ${name}${detail ? "  " + detail : ""}`);
};

const leadCount = () => (existsSync(LEAD_FILE) ? readFileSync(LEAD_FILE, "utf-8").trim().split("\n").filter(Boolean).length : 0);

async function startApi(stress, port = API_PORT) {
  const base = `http://localhost:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "serve.mjs"), "../../output/prototypes", String(port)], {
    env: { ...process.env, STRESS: stress ? "1" : "" },
    stdio: "ignore"
  });
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return child;
    } catch {}
  }
  throw new Error(`测试服务启动失败（端口 ${port}）`);
}

const post = (body, headers = {}) =>
  fetch(`${API}/api/lead`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

const validInquiry = (extra = {}) => ({
  kind: "inquiry",
  lang: "ru",
  name: "Тест Тестов",
  phone: "+998 90 123 45 67",
  email: "test@example.com",
  city: "Ташкент",
  message: "Вопрос о корме",
  consent: true,
  request_id: "test-" + Math.random().toString(16).slice(2),
  page: "/a/ru/contact/",
  source: "prototype-a",
  ...extra
});

// ---------- 服务端 API 测试（STRESS=1 放开限流，避免前序合法请求干扰功能校验） ----------
let api = await startApi(true);
try {
  const before = leadCount();
  let res = await post(validInquiry());
  let data = await res.json();
  record("有效咨询提交", res.status === 200 && data.ok === true && data.mock === true && /^MP-/.test(data.ref), `ref=${data.ref}`);
  record("模拟线索写入本地文件", leadCount() === before + 1, `lines=${leadCount()}`);

  res = await post(validInquiry({ name: "" }));
  data = await res.json();
  record("必填校验（缺姓名）", res.status === 400 && data.errors.includes("required"));

  res = await post(validInquiry({ phone: "12" }));
  data = await res.json();
  record("手机号格式校验", res.status === 400 && data.errors.includes("phone"));

  res = await post(validInquiry({ email: "not-an-email" }));
  data = await res.json();
  record("邮箱格式校验", res.status === 400 && data.errors.includes("email"));

  res = await post(validInquiry({ consent: false }));
  data = await res.json();
  record("隐私同意校验", res.status === 400 && data.errors.includes("consent"));

  res = await post({ kind: "dealer", lang: "en", name: "Test", phone: "+998901234567", consent: true, channel: "" });
  data = await res.json();
  record("经销商表单必填（公司/渠道）", res.status === 400 && data.errors.filter((e) => e === "required").length >= 1);

  res = await post(validInquiry({ message: "x".repeat(2500) }));
  data = await res.json();
  record("超长内容校验", res.status === 400 && data.errors.includes("too_long"));

  res = await fetch(`${API}/api/lead`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
  record("错误 Content-Type 拒绝", res.status === 415);

  res = await post(validInquiry(), { Origin: "https://evil.example" });
  record("跨站来源拒绝（CSRF）", res.status === 403);

  const noXss = await post(validInquiry({ name: '<img src=x onerror="window.__xss=1">', message: "<script>1</script>" }));
  data = await noXss.json();
  const stored = readFileSync(LEAD_FILE, "utf-8").trim().split("\n").map((l) => JSON.parse(l)).pop();
  record(
    "XSS 载荷安全落库",
    noXss.status === 200 && !/onerror|<script/i.test(JSON.stringify(stored)) && String(stored.name_masked).length <= 4,
    `masked=${stored.name_masked}`
  );

  const dupId = "dup-" + Date.now();
  const dupA = await (await post(validInquiry({ request_id: dupId }))).json();
  const dupBRes = await post(validInquiry({ request_id: dupId }));
  const dupB = await dupBRes.json();
  record("幂等键去重", dupA.ref === dupB.ref && dupB.duplicate === true, `ref=${dupB.ref}`);

  const hpBefore = leadCount();
  res = await post(validInquiry({ website: "http://spam.example" }));
  data = await res.json();
  record("蜜罐拦截（返回成功但不落库）", res.status === 200 && leadCount() === hpBefore);

  const lines = readFileSync(LEAD_FILE, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  const lastMasked = lines[lines.length - 1];
  record(
    "日志脱敏（手机号/邮箱/姓名）",
    !/\d{7,}/.test(JSON.stringify(lastMasked)) && lastMasked.phone_masked.includes("*") && lastMasked.email_masked.includes("***"),
    `${lastMasked.phone_masked} / ${lastMasked.email_masked}`
  );
  record("记录语言与营销来源", !!lastMasked.lang && !!lastMasked.source, `lang=${lastMasked.lang} source=${lastMasked.source}`);
} finally {
  api.kill();
}

// ---------- 限流（全新进程、不放开限流，避免前序请求污染计数） ----------
api = await startApi(false);
try {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const r = await post(validInquiry({ request_id: "rate-" + i }));
    codes.push(r.status);
  }
  record("限流触发 429", codes.filter((c) => c === 429).length >= 2, codes.join(","));
} finally {
  api.kill();
}

// ---------- 浏览器端表单交互 ----------
const uiServer = await startApi(true, UI_PORT);
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=9334", `--user-data-dir=${path.resolve(ROOT, "data/temp/chrome-forms")}`, "about:blank"],
  { stdio: "ignore" }
);
let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9334/json/list")).json();
    const page = list.find((p) => p.type === "page");
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
}
if (!wsUrl) {
  console.error("Chrome 调试端口不可用");
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
const evaluate = (expression) => send("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression }).then((r) => r.result.value);
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

const fillScript = (kind) => `(() => {
  const form = document.querySelector('form[data-kind="${kind}"]');
  const set = (name, value) => { const el = form.elements[name]; if (el) el.value = value; };
  if (${kind === "dealer" ? "true" : "false"}) { set('company', 'Test Pet Shop'); set('volume', '200 packs'); const ch = form.elements.channel; ch.value = 'pet_shop'; }
  set('name', 'Aziz Test');
  set('phone', '+998 90 111 22 33');
  set('email', 'aziz@example.com');
  set('city', 'Tashkent');
  set('message', 'Please advise on kitten food');
  form.elements.consent.checked = true;
  form.requestSubmit();
  return true;
})()`;

for (const theme of ["a", "b", "c"]) {
  for (const lang of ["en", "ru", "ar"]) {
    await send("Page.navigate", { url: `${UI_BASE}/${theme}/${lang}/contact/` });
    await sleep(400);
    await evaluate(`(() => { const f = document.querySelector('form[data-kind="inquiry"]'); f.requestSubmit(); return true; })()`);
    await sleep(250);
    const emptyState = await evaluate(`(() => { const s = document.querySelector('.form-status'); return { state: s.dataset.state, text: s.textContent, hidden: s.hidden }; })()`);
    record(`[${theme}/${lang}] 空表单前端拦截`, emptyState.state === "error" && emptyState.hidden === false && emptyState.text.length > 0, emptyState.text.slice(0, 40));

    await evaluate(fillScript("inquiry"));
    await sleep(1200);
    const okState = await evaluate(`(() => { const s = document.querySelector('.form-status'); return { state: s.dataset.state, text: s.textContent, xss: window.__xss === 1 }; })()`);
    record(`[${theme}/${lang}] 咨询表单提交成功`, okState.state === "success" && /MP-/.test(okState.text) && !okState.xss, okState.text.replace(/\s+/g, " ").slice(0, 60));

    await send("Page.navigate", { url: `${UI_BASE}/${theme}/${lang}/partners/` });
    await sleep(400);
    await evaluate(fillScript("dealer"));
    await sleep(1200);
    const dealerState = await evaluate(`(() => { const s = document.querySelector('.form-status'); return { state: s.dataset.state, text: s.textContent }; })()`);
    record(`[${theme}/${lang}] 经销商表单提交成功`, dealerState.state === "success" && /MP-/.test(dealerState.text), dealerState.text.replace(/\s+/g, " ").slice(0, 50));
  }
}

// XSS 注入后 DOM 应无注入元素
await send("Page.navigate", { url: `${UI_BASE}/b/en/contact/` });
await sleep(400);
await evaluate(`(() => {
  const form = document.querySelector('form[data-kind="inquiry"]');
  form.elements.name.value = '<img src=x onerror="window.__xss=1">';
  form.elements.phone.value = '+998 90 111 22 33';
  form.elements.consent.checked = true;
  form.requestSubmit();
  return true;
})()`);
await sleep(1200);
const xssCheck = await evaluate(`({ injected: document.querySelectorAll('form img').length, xss: window.__xss === 1 })`);
record("表单 XSS 注入无执行", xssCheck.injected === 0 && xssCheck.xss === false, JSON.stringify(xssCheck));

ws.close();
chrome.kill();
uiServer.kill();

mkdirSync(path.join(ROOT, "output/evidence"), { recursive: true });
writeFileSync(
  path.join(ROOT, "output/evidence/qa-forms.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), api: API, ui: UI_BASE, total: results.length, failed: results.filter((r) => !r.pass).length, results }, null, 2)
);
const failed = results.filter((r) => !r.pass).length;
console.log(`=== 表单测试：${results.length} 项，失败 ${failed} 项 ===`);
process.exit(failed ? 2 : 0);
