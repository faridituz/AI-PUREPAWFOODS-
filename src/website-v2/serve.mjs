import http from "node:http";
import { readFile, stat, appendFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLead } from "./core/validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORMS_MODE = (() => {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, "content/forms.json"), "utf-8")).meta.mode;
  } catch {
    return "closed";
  }
})();
const ROOT = path.resolve(__dirname, process.argv[2] || "../../output/prototypes");
const PORT = Number(process.argv[3] || 4173);
const STRESS = process.env.STRESS === "1";
const LEAD_DIR = path.resolve(__dirname, "../../data/mock-leads");
const LEAD_FILE = path.join(LEAD_DIR, "leads.jsonl");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "X-Robots-Tag": "noindex, nofollow"
};

// ---------- 模拟线索存储（脱敏，只写本地 data/，绝不进入真实 CRM） ----------
const maskName = (s) => (s ? s.slice(0, 1) + "***" : "");
const maskPhone = (s) => (s && s.length > 4 ? s.slice(0, 4) + "*".repeat(Math.max(0, s.length - 6)) + s.slice(-2) : "***");
const maskEmail = (s) => {
  if (!s) return "";
  const [user, domain] = s.split("@");
  return user === undefined ? "***" : (user ? user[0] + "***" : "***") + (domain ? "@" + domain : "");
};

let leadSeq = 0;
async function storeLead(data, ref) {
  await mkdir(LEAD_DIR, { recursive: true });
  const record = {
    ref,
    ts: new Date().toISOString(),
    kind: data.kind,
    lang: String(data.lang || "").slice(0, 5),
    source: String(data.source || "").slice(0, 40),
    page: String(data.page || "").slice(0, 120),
    utm: String(data.utm || "").slice(0, 120),
    city: String(data.city || "").slice(0, 80),
    channel: String(data.channel || "").slice(0, 40),
    product: String(data.product || "").slice(0, 80),
    volume: String(data.volume || "").slice(0, 80),
    name_masked: maskName(String(data.name || "").trim()),
    phone_masked: maskPhone(String(data.phone || "").trim()),
    email_masked: maskEmail(String(data.email || "").trim()),
    message_len: String(data.message || "").length,
    mock: true
  };
  record.seq = ++leadSeq;
  await appendFile(LEAD_FILE, JSON.stringify(record) + "\n", "utf-8");
  return record;
}

// ---------- 限流 / 幂等 ----------
const LIMITS = STRESS ? { windowMs: 60_000, windowMax: 100_000, hourMax: 1_000_000 } : { windowMs: 60_000, windowMax: 5, hourMax: 30 };
const rateMap = new Map();
const idemMap = new Map();

function rateLimited(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now - entry.hourStart > 3_600_000) {
    entry = { windowStart: now, windowCount: 0, hourStart: now, hourCount: 0 };
    rateMap.set(ip, entry);
  }
  if (now - entry.windowStart > LIMITS.windowMs) {
    entry.windowStart = now;
    entry.windowCount = 0;
  }
  entry.windowCount += 1;
  entry.hourCount += 1;
  return entry.windowCount > LIMITS.windowMax || entry.hourCount > LIMITS.hourMax;
}

function rememberIdem(id, value) {
  if (!id) return;
  idemMap.set(id, value);
  if (idemMap.size > 2000) idemMap.delete(idemMap.keys().next().value);
}

// ---------- 统计（仅 STRESS=1 时对外） ----------
const startedAt = Date.now();
let requestCount = 0;
let leadCount = 0;

const json = (res, code, body, headers = {}) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
    ...headers
  });
  res.end(JSON.stringify(body));
};

function readBody(req, limit = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("too large"), { code: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  return true;
}

async function handleLead(req, res) {
  if (!sameOrigin(req)) return json(res, 403, { ok: false, errors: ["forbidden"] });
  const type = String(req.headers["content-type"] || "");
  if (!type.includes("application/json")) return json(res, 415, { ok: false, errors: ["content_type"] });

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (err) {
    return json(res, err.code === 413 ? 413 : 400, { ok: false, errors: [err.code === 413 ? "too_long" : "json"] });
  }

  const ip = req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return json(res, 429, { ok: false, errors: ["rate"] }, { "Retry-After": "60" });
  }

  const check = validateLead(payload);
  if (check.errors.includes("spam") || payload.website) {
    // 蜜罐命中：返回成功但不保存
    return json(res, 200, { ok: true, mock: true, ref: "HP-" + Math.random().toString(16).slice(2, 8) });
  }
  if (!check.ok) {
    return json(res, 400, { ok: false, errors: check.errors });
  }

  const idemKey = String(payload.request_id || req.headers["x-request-id"] || "").slice(0, 64);
  if (idemKey && idemMap.has(idemKey)) {
    return json(res, 200, { ok: true, mock: true, duplicate: true, ...idemMap.get(idemKey) });
  }

  const ref = "MP-" + Math.random().toString(16).slice(2, 8).toUpperCase();
  const result = { ref, mock: true, stored: "data/mock-leads/leads.jsonl", note: "本地模拟线索，未进入真实 CRM" };
  rememberIdem(idemKey, result);
  await storeLead(
    {
      ...check.values,
      kind: check.kind,
      lang: payload.lang,
      source: payload.source,
      page: payload.page,
      utm: payload.utm
    },
    ref
  ).catch(() => {});
  leadCount += 1;
  return json(res, 200, { ok: true, ...result });
}

async function sendNotFound(req, res, pathname) {
  const m = pathname.match(/^\/([abcd])\/([a-z]{2})\//);
  if (m) {
    try {
      const html = await readFile(path.join(ROOT, m[1], "errors", `${m[2]}.html`));
      res.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Language": m[2],
        ...SECURITY_HEADERS
      });
      return res.end(req.method === "HEAD" ? undefined : html);
    } catch {}
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS }).end("not found");
}

const server = http.createServer(async (req, res) => {
  requestCount += 1;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === "/api/lead") {
      if (FORMS_MODE !== "online") return json(res, 404, { ok: false, errors: ["forms_closed"] });
      if (req.method !== "POST") return json(res, 405, { ok: false, errors: ["method"] });
      return await handleLead(req, res);
    }
    if (pathname === "/api/health") {
      return json(res, 200, { ok: true, mode: "mock", uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
    }
    if (STRESS && pathname === "/__admin/stats") {
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      return json(res, 200, {
        uptimeSec: (Date.now() - startedAt) / 1000,
        requests: requestCount,
        leads: leadCount,
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
        cpuUser: cpu.user,
        cpuSystem: cpu.system
      });
    }
    if (STRESS && pathname === "/__admin/reset") {
      rateMap.clear();
      requestCount = 0;
      leadCount = 0;
      return json(res, 200, { ok: true });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(res, 405, { ok: false, errors: ["method"] });
    }

    if (pathname === "/") {
      res.writeHead(302, { Location: "/a/en/", ...SECURITY_HEADERS });
      return res.end();
    }
    const themeMatch = pathname.match(/^\/([abc])\/?$/);
    if (themeMatch) {
      res.writeHead(302, { Location: `/${themeMatch[1]}/en/`, ...SECURITY_HEADERS });
      return res.end();
    }

    let file = path.join(ROOT, pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403, SECURITY_HEADERS).end("forbidden");
      return;
    }
    const info = await stat(file).catch(() => null);
    if (info?.isDirectory()) file = path.join(file, "index.html");
    const data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const isHtml = ext === ".html";
    const isAsset = [".css", ".js", ".png", ".jpg", ".svg"].includes(ext);
    const lang = pathname.match(/^\/(?:a|b|c)\/([a-z]{2})\//)?.[1];

    const etag = `W/"${Buffer.byteLength(data).toString(16)}-${Math.floor((info?.mtimeMs || Date.now()) / 1000).toString(16)}"`;
    if (isAsset && req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ETag: etag, "Cache-Control": "public, max-age=31536000, immutable", ...SECURITY_HEADERS });
      return res.end();
    }

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : isHtml ? "no-cache" : "public, max-age=300",
      ...(isAsset ? { ETag: etag } : {}),
      ...(lang ? { "Content-Language": lang } : {}),
      ...SECURITY_HEADERS
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    await sendNotFound(req, res, pathname);
  }
});

server.requestTimeout = 20_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, () => console.log(`原型预览 http://localhost:${PORT}/  (根目录 ${ROOT}${STRESS ? "，压测统计已开启" : ""})`));
