import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LANGS8 = ["en", "zh", "ru", "ar", "uz", "kk", "ky", "tg"];
const LANGS6 = LANGS8.slice(0, 6);
const results = [];

function startServer(port, tag) {
  const child = spawn(process.execPath, [path.join(__dirname, "serve.mjs"), "../../output/prototypes", String(port)], {
    env: { ...process.env, STRESS: "1" },
    stdio: "ignore"
  });
  return { child, tag, port };
}

async function waitServer(port) {
  for (let i = 0; i < 50; i++) {
    await sleep(120);
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch {}
  }
  throw new Error("测试服务未启动");
}

async function stats(port) {
  const res = await fetch(`http://localhost:${port}/__admin/stats`);
  return res.json();
}

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else total += s.size;
    }
  };
  try {
    walk(dir);
  } catch {}
  return total;
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

async function scenario({ name, concurrency, durationMs, total, pick, serverPort = PORT, expectLang = null }) {
  const baseline = await stats(serverPort);
  const latencies = [];
  const statuses = {};
  let bytes = 0;
  let errors = 0;
  let langMismatch = 0;
  let sent = 0;
  let stop = false;
  const start = Date.now();
  const samples = [];
  const sampler = setInterval(async () => {
    try {
      samples.push(await stats(serverPort));
    } catch {}
  }, 500);

  const worker = async () => {
    while (!stop) {
      if (total && sent >= total) break;
      if (!total && Date.now() - start > durationMs) break;
      const i = sent++;
      const spec = pick(i);
      const t0 = performance.now();
      try {
        const res = await fetch(spec.url, {
          method: spec.method || "GET",
          headers: spec.headers,
          body: spec.body,
          signal: AbortSignal.timeout(8000)
        });
        const buf = await res.arrayBuffer();
        latencies.push(performance.now() - t0);
        bytes += buf.byteLength;
        statuses[res.status] = (statuses[res.status] || 0) + 1;
        if (expectLang) {
          const cl = res.headers.get("content-language");
          if (cl && cl !== expectLang(spec)) langMismatch++;
        }
      } catch {
        errors++;
        statuses.error = (statuses.error || 0) + 1;
        latencies.push(performance.now() - t0);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  stop = true;
  clearInterval(sampler);
  const wallMs = Date.now() - start;
  await sleep(1500);
  const after = await stats(serverPort);
  const rssSamples = samples.map((s) => s.rss);
  const cpuSamples = samples.map((s) => s.cpuUser + s.cpuSystem);
  const cpuDeltas = cpuSamples.slice(1).map((v, i) => (v - cpuSamples[i]) / (500 * 1000) * 100);
  const ok = (statuses[200] || 0) + (statuses[304] || 0);
  const row = {
    name,
    concurrency,
    requests: sent,
    durationSec: +(wallMs / 1000).toFixed(2),
    throughput: +(sent / (wallMs / 1000)).toFixed(1),
    failures: errors + (statuses[500] || 0),
    failureRate: +(((errors + (statuses[500] || 0)) / Math.max(1, sent)) * 100).toFixed(2),
    p50: +pct(latencies, 50).toFixed(1),
    p95: +pct(latencies, 95).toFixed(1),
    p99: +pct(latencies, 99).toFixed(1),
    max: +Math.max(0, ...latencies).toFixed(1),
    trafficMB: +(bytes / 1048576).toFixed(1),
    statuses,
    rssBaselineMB: +(baseline.rss / 1048576).toFixed(1),
    rssPeakMB: +(Math.max(baseline.rss, ...(rssSamples.length ? rssSamples : [0])) / 1048576).toFixed(1),
    rssAfterMB: +(after.rss / 1048576).toFixed(1),
    cpuAvgPct: +(cpuDeltas.length ? cpuDeltas.reduce((a, b) => a + b, 0) / cpuDeltas.length : 0).toFixed(1),
    cpuPeakPct: +(cpuDeltas.length ? Math.max(...cpuDeltas) : 0).toFixed(1),
    langMismatch,
    ok
  };
  results.push(row);
  console.log(
    `${name.padEnd(22)} c=${String(concurrency).padStart(3)}  RPS=${String(row.throughput).padStart(7)}  P50=${String(row.p50).padStart(6)}ms P95=${String(row.p95).padStart(6)}ms P99=${String(row.p99).padStart(6)}ms  失败=${row.failureRate}%  RSS峰=${row.rssPeakMB}MB  CPU均=${row.cpuAvgPct}%`
  );
  return row;
}

// ---------- 环境 ----------
const env = {
  node: process.version,
  platform: `${os.platform()} ${os.release()}`,
  cpu: os.cpus()[0]?.model,
  cores: os.cpus().length,
  totalMemGB: +(os.totalmem() / 1073741824).toFixed(1),
  freeMemGB: +(os.freemem() / 1073741824).toFixed(1),
  note: "本机隔离端口压力测试，不代表 GoDaddy 生产主机承载能力"
};
console.log("环境:", JSON.stringify(env));

const leadFile = path.join(ROOT, "data/mock-leads/leads.jsonl");
const leadsBefore = (() => { try { return readFileSync(leadFile, "utf-8").trim().split("\n").filter(Boolean).length; } catch { return 0; } })();
const diskBefore = { prototypesMB: +(dirSize(path.join(ROOT, "output/prototypes")) / 1048576).toFixed(1), leadsMB: +(dirSize(path.join(ROOT, "data/mock-leads")) / 1048576).toFixed(2) };

let main = startServer(PORT, "main");
await waitServer(PORT);

// 预热
await scenario({ name: "预热（不计入）", concurrency: 10, durationMs: 3000, pick: (i) => ({ url: `${BASE}/b/en/` }) });

// 单语言：10 / 50 / 100 并发
for (const c of [10, 50, 100]) {
  await scenario({ name: "单语言 首页 en", concurrency: c, durationMs: 15000, pick: () => ({ url: `${BASE}/b/en/` }) });
}

// 混合 8 语言 与 6 语言
await scenario({
  name: "混合 8 语言 首页",
  concurrency: 50,
  durationMs: 15000,
  expectLang: (spec) => spec.url.match(/\/([a-z]{2})\//)[1],
  pick: (i) => ({ url: `${BASE}/b/${LANGS8[i % LANGS8.length]}/` })
});
await scenario({
  name: "混合 6 语言 首页",
  concurrency: 50,
  durationMs: 12000,
  expectLang: (spec) => spec.url.match(/\/([a-z]{2})\//)[1],
  pick: (i) => ({ url: `${BASE}/b/${LANGS6[i % LANGS6.length]}/` })
});

// 产品页 / 语言切换序列
await scenario({ name: "产品页 en", concurrency: 50, durationMs: 10000, pick: () => ({ url: `${BASE}/b/en/product/kitten-chicken/` }) });
await scenario({
  name: "语言切换序列",
  concurrency: 20,
  durationMs: 10000,
  expectLang: (spec) => spec.url.match(/\/([a-z]{2})\//)[1],
  pick: (i) => ({ url: `${BASE}/b/${LANGS8[(i >> 2) % LANGS8.length]}/product/kitten-chicken/` })
});

// 表单 POST
const formPayload = (i) =>
  JSON.stringify({
    kind: "inquiry",
    lang: "ru",
    name: "Load Test",
    phone: "+998 90 000 00 00",
    email: "load@example.com",
    city: "Tashkent",
    message: "Нагрузочный тест",
    consent: true,
    request_id: `stress-${process.pid}-${i}`,
    page: "/b/ru/contact/",
    source: "prototype-b"
  });
await scenario({
  name: "表单 POST",
  concurrency: 10,
  total: 400,
  pick: (i) => ({ url: `${BASE}/api/lead`, method: "POST", headers: { "Content-Type": "application/json" }, body: formPayload(i) })
});

// 静态资源 冷/热
await scenario({ name: "静态资源 热缓存", concurrency: 50, durationMs: 8000, pick: () => ({ url: `${BASE}/b/assets/base.css` }) });

// 长跑内存
await scenario({ name: "长跑 60s 混合语言", concurrency: 20, durationMs: 60000, pick: (i) => ({ url: `${BASE}/c/${LANGS8[i % LANGS8.length]}/` }) });

// 缓存失效：修改资源后 ETag 变化 + 304 语义
const cssPath = path.join(ROOT, "output/prototypes/b/assets/base.css");
const resAsset = await fetch(`${BASE}/b/assets/base.css`);
const etag1 = resAsset.headers.get("etag");
const revalidate = await fetch(`${BASE}/b/assets/base.css`, { headers: { "If-None-Match": etag1 } });
writeFileSync(cssPath, readFileSync(cssPath, "utf-8") + "\n/* cache-invalidation-test */\n");
const resAsset2 = await fetch(`${BASE}/b/assets/base.css`);
const etag2 = resAsset2.headers.get("etag");
const cacheTest = {
  etagBefore: etag1,
  etagAfter: etag2,
  revalidateStatus: revalidate.status,
  changedAfterEdit: etag1 !== etag2,
  immutable: resAsset.headers.get("cache-control"),
  htmlCache: (await fetch(`${BASE}/b/en/`)).headers.get("cache-control")
};

// 冷启动资源（新进程）
main.child.kill();
await sleep(500);
const cold = startServer(4181, "cold");
await waitServer(4181);
await scenario({ name: "静态资源 冷启动", concurrency: 50, total: 300, serverPort: 4181, pick: () => ({ url: `http://localhost:4181/b/assets/base.css` }) });
cold.child.kill();

const leadsAfter = (() => { try { return readFileSync(leadFile, "utf-8").trim().split("\n").filter(Boolean).length; } catch { return 0; } })();
const diskAfter = { prototypesMB: +(dirSize(path.join(ROOT, "output/prototypes")) / 1048576).toFixed(1), leadsMB: +(dirSize(path.join(ROOT, "data/mock-leads")) / 1048576).toFixed(2) };

const longRun = results.find((r) => r.name.startsWith("长跑"));
const summary = {
  generatedAt: new Date().toISOString(),
  environment: env,
  note: "本机隔离压测结果，仅用于原型性能评估，不代表 GoDaddy 生产主机实际承载能力；未对正式网站施加压测。",
  scenarios: results,
  cache: cacheTest,
  leads: { before: leadsBefore, after: leadsAfter, added: leadsAfter - leadsBefore },
  disk: { before: diskBefore, after: diskAfter },
  memory: longRun
    ? {
        baselineMB: longRun.rssBaselineMB,
        peakMB: longRun.rssPeakMB,
        afterMB: longRun.rssAfterMB,
        growthMB: +(longRun.rssAfterMB - longRun.rssBaselineMB).toFixed(1),
        note: "Node 未强制 GC，RSS 回落滞后；增长 <30MB 视为无显著泄漏迹象，需长周期复测"
      }
    : null
};
mkdirSync(path.join(ROOT, "output/evidence"), { recursive: true });
writeFileSync(path.join(ROOT, "output/evidence/stress-report.json"), JSON.stringify(summary, null, 2));
console.log("=== 压测完成 -> output/evidence/stress-report.json ===");
console.log("缓存测试:", JSON.stringify(cacheTest));
process.exit(0);
