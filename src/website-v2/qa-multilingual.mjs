import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS } from "./core/content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
// BASE：实际抓取地址；PUBLIC：页面里 canonical/hreflang/sitemap 应使用的公开域名
const BASE = argOf("--base", "http://localhost:4173");
const PUBLIC = argOf("--origin", BASE);
// --prod：按生产期望断言（允许收录、robots 放行）；默认按测试环境断言（noindex、禁止收录）
const PROD = process.argv.includes("--prod");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (name) => JSON.parse(readFileSync(path.join(__dirname, "content", name), "utf-8"));

const langFile = readJson("languages.json");
const LANGS = langFile.languages.filter((l) => l.enabled).map((l) => l.code);
const SITE = readJson("site.json");
const UI = readJson("ui.json");
const FORMS = readJson("forms.json");
const MKT = readJson("marketing.json");
const ERRORS = readJson("errors.json");
const D = readJson("d.json");
const THEMES = ["a", "b", "c", "d"];

const results = [];
const record = (group, name, pass, detail = "") => {
  results.push({ group, name, pass, detail });
  if (!pass) console.log(`失败 [${group}] ${name} ${detail}`);
};

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? flatten(v, prefix + k + ".") : [[prefix + k, v]]
  );

const hasCJK = (t) => /[\u4e00-\u9fff]/.test(t);
const hasArabic = (t) => /[\u0600-\u06ff]/.test(t);
const hasCyrillic = (t) => /[\u0400-\u04ff]/.test(t);
const scriptOk = (lang, text) => {
  if (lang === "zh") return hasCJK(text);
  if (lang === "ar") return hasArabic(text);
  if (["ru", "kk", "ky", "tg"].includes(lang)) return hasCyrillic(text);
  return !hasCJK(text) && !hasArabic(text) && !hasCyrillic(text);
};

// ---------- 1. 静态内容完整性 ----------
for (const lang of LANGS) {
  for (const [label, dict] of [
    ["ui", UI.ui[lang]],
    ["forms", FORMS.langs[lang]],
    ["marketing", MKT.langs[lang]],
    ["errors", { ...ERRORS.langs[lang] }],
    ["d", D.langs[lang]]
  ]) {
    const en = flatten(
      label === "ui" ? UI.ui.en : label === "forms" ? FORMS.langs.en : label === "marketing" ? MKT.langs.en : label === "d" ? D.langs.en : ERRORS.langs.en
    );
    const me = flatten(dict);
    const meKeys = new Set(me.map(([k]) => k));
    const enKeys = new Set(en.map(([k]) => k));
    const missing = [...enKeys].filter((k) => !meKeys.has(k));
    record("翻译完整性", `${lang}/${label} 键完整`, missing.length === 0, missing.join(","));
    for (const [key, value] of me) {
      if (typeof value !== "string" || value.trim().length < 3) continue;
      if (!/[A-Za-z]{3,}/.test(value)) continue;
      if (/^[^@\s]+@[^@\s]+$/.test(value)) continue;
      const enValue = en.find(([k]) => k === key)?.[1];
      if (lang !== "en" && value === enValue && !/whatsapp/i.test(key) && !/^PURE PAW/.test(value)) {
        record("翻译完整性", `${lang}/${label}.${key} 未被直接复用英文`, false, value.slice(0, 40));
      }
    }
  }
}

// ---------- 2. 产品规格与营养数字一致性 ----------
const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).join("|");
for (let i = 0; i < SITE.en.products.length; i++) {
  const baseNet = nums(SITE.en.products[i].net);
  const baseName = nums(SITE.en.products[i].name);
  for (const lang of LANGS) {
    const p = SITE[lang].products[i];
    record("规格一致性", `${lang} 产品#${i + 1} 净重数字`, nums(p.net) === baseNet, `${nums(p.net)} vs ${baseNet}`);
    record("规格一致性", `${lang} 产品#${i + 1} 名称内数字`, nums(p.name) === baseName, `${nums(p.name)} vs ${baseName}`);
    record("规格一致性", `${lang} 产品#${i + 1} 成分非空`, String(p.ingredients || "").trim().length > 10);
  }
}

// ---------- 3. HTTP 检查 ----------
const fetchText = async (url) => {
  const res = await fetch(url);
  return { status: res.status, text: await res.text(), headers: res.headers };
};

const buildUrlSet = (theme) => {
  const rels = ["", "cat", "dog", "brand", "partners", "contact", ...PRODUCTS.map((p) => "product/" + p.slug)];
  const set = new Set();
  for (const lang of LANGS) for (const rel of rels) set.add(`${PUBLIC}/${theme}/${lang}/${rel ? rel + "/" : ""}`);
  return set;
};

const closedFeaturePatterns = [
  [/\bcart\b|\bcheckout\b|add to cart|savat|корзин|سلة|购物车/i, "购物车/结账"],
  [/\b(buy now|sotib oling|купить|اشتري|立即购买)\b/i, "购买按钮"],
  [/store locator|find a store|do'kon manzili|адрес магазина/i, "门店定位器"],
  [/\d[\d\s.,]*\s*(so'?m|сум|UZS|руб|₽|\$|€)/i, "显示价格"],
  [/(href|action)="[^"]*\/(cart|checkout|shop|account|login|wp-admin)/i, "电商/后台链接"]
];

for (const theme of THEMES) {
  const expectedUrls = buildUrlSet(theme);
  const altSets = {};
  for (const lang of LANGS) {
    for (const rel of ["", "product/kitten-chicken", "contact"]) {
      const url = `${BASE}/${theme}/${lang}/${rel ? rel + "/" : ""}`;
      const publicUrl = `${PUBLIC}/${theme}/${lang}/${rel ? rel + "/" : ""}`;
      const { status, text, headers } = await fetchText(url);
      const tag = `${theme}/${lang}/${rel || "home"}`;
      record("页面可访问", tag, status === 200);
      const title = (text.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
      const desc = (text.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
      const htmlLang = (text.match(/<html lang="([^"]+)"/) || [])[1];
      const dir = (text.match(/<html lang="[^"]+" dir="([^"]+)"/) || [])[1];
      record("标题语言", tag, scriptOk(lang, title), title.slice(0, 50));
      record("描述语言", tag, scriptOk(lang, desc), desc.slice(0, 50));
      record("html lang", tag, htmlLang === lang, htmlLang);
      record("html dir", tag, dir === (lang === "ar" ? "rtl" : "ltr"), dir);
      const canonical = (text.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
      record("canonical 自引用", tag, canonical === publicUrl, canonical);
      const alts = [...text.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
      record("hreflang 数量", tag, alts.length === LANGS.length + 1, String(alts.length));
      for (const [code, href] of alts) record("hreflang 目标", `${tag} ${code}`, expectedUrls.has(href) || href === publicUrl, href);
      record("noindex", tag, PROD ? !/name="robots"[^>]*noindex/.test(text) : /<meta name="robots" content="noindex, nofollow"/.test(text));
      record("CSP 响应头", tag, !!headers.get("content-security-policy"));
      if (!rel) {
        altSets[lang] = alts;
        for (const [pattern, label] of closedFeaturePatterns) record("封闭功能", `${tag} 无${label}`, !pattern.test(text));
      }
      if (rel === "contact") {
        if (FORMS.meta.mode === "online") {
          const msg = (text.match(/data-msg-required="([^"]*)"/) || [])[1] || "";
          record("表单提示语言", tag, scriptOk(lang, msg), msg.slice(0, 40));
          const ph = (text.match(/placeholder="([^"]*)"/) || [])[1] || "";
          record("表单占位语言", tag, scriptOk(lang, ph), ph.slice(0, 40));
        } else {
          record("表单关闭", tag, !/<form\b|data-lead-form/.test(text));
          const closed = (FORMS.langs[lang] || {}).closed || {};
          record("关闭说明语言", tag, scriptOk(lang, closed.note || ""), (closed.note || "").slice(0, 40));
          record("咨询渠道", tag, /https:\/\/wa\.me\//.test(text) && /href="tel:\+/.test(text));
        }
      }
    }
  }
  // 双向 hreflang：8 个语言首页的 alternate 集合必须一致
  const reference = JSON.stringify(altSets.en);
  for (const lang of LANGS) record("hreflang 双向一致", `${theme}/${lang}`, JSON.stringify(altSets[lang]) === reference);

  const sitemap = await fetchText(`${BASE}/${theme}/sitemap.xml`);
  const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  record("sitemap", `${theme} URL 数`, locs.length === expectedUrls.size, `${locs.length} vs ${expectedUrls.size}`);
  record("sitemap", `${theme} URL 集合一致`, locs.every((u) => expectedUrls.has(u)) && [...expectedUrls].every((u) => locs.includes(u)));
  const robots = await fetchText(`${BASE}/${theme}/robots.txt`);
  record("robots", `${theme} ${PROD ? "允许收录" : "禁止收录"}`, PROD ? !/Disallow: \//.test(robots.text) : /Disallow: \//.test(robots.text));

  // sitemap 内所有 URL 均返回 200
  const checks = [];
  const queue = [...locs];
  const workers = Array.from({ length: 16 }, async () => {
    while (queue.length) {
      const u = queue.shift();
      // 生产构建的 sitemap 写的是公开域名，本地复检时映射回抓取地址
      const local = u.startsWith(PUBLIC) ? BASE + u.slice(PUBLIC.length) : u;
      const res = await fetch(local, { method: "HEAD" }).catch(() => ({ status: 0 }));
      checks.push(res.status);
    }
  });
  await Promise.all(workers);
  record("sitemap", `${theme} 全部 URL 可访问`, checks.every((s) => s === 200), checks.filter((s) => s !== 200).length + " 个异常");
}

// 404 本地化
for (const theme of THEMES) {
  for (const lang of LANGS) {
    const { status, text } = await fetchText(`${BASE}/${theme}/${lang}/no-such-page/`);
    const title = (text.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    record("错误页语言", `${theme}/${lang}`, status === 404 && title.includes(ERRORS.langs[lang].title), title.slice(0, 40));
  }
}

// ---------- 4. 浏览器渲染与字体字形启发式 ----------
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=9336", `--user-data-dir=${path.resolve(ROOT, "data/temp/chrome-ml")}`, "about:blank"],
  { stdio: "ignore" }
);
let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch("http://127.0.0.1:9336/json/list")).json();
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

for (const theme of THEMES) {
  for (const lang of LANGS) {
    await send("Page.navigate", { url: `${BASE}/${theme}/${lang}/` });
    await sleep(400);
    const v = await evaluate(`(() => {
      const imgs = [...document.images];
      const controls = [...document.querySelectorAll('form input:not([type=hidden]), form select, form textarea')];
      const unlabeled = controls.filter(el => {
        if (el.type === 'checkbox') return !el.closest('label');
        if (el.getAttribute('aria-label')) return false;
        return !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
      }).length;
      const telLinks = [...document.querySelectorAll('a[href^="tel:"]')].map(a => ({ text: a.textContent.trim(), dir: getComputedStyle(a).direction }));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = '16px sans-serif';
      const sample = (document.querySelector('main').innerText || '').replace(/\\s+/g, '').slice(0, 160);
      const tofuWidth = ctx.measureText('\\uFFFD').width;
      let suspicious = 0;
      for (const ch of new Set(sample)) {
        if (/[\\s]/.test(ch)) continue;
        const w = ctx.measureText(ch).width;
        if (Math.abs(w - tofuWidth) < 0.01) suspicious++;
      }
      return {
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        title: document.title,
        imgs: imgs.length,
        imgsNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length,
        controls: controls.length,
        unlabeled,
        tels: telLinks,
        cards: document.querySelectorAll('.card').length,
        groups: document.querySelectorAll('.group-card').length,
        switchLinks: document.querySelectorAll('.lang-menu a').length,
        suspiciousChars: suspicious
      };
    })()`);
    const tag = `${theme}/${lang}`;
    record("渲染", `${tag} 图片均有 alt`, v.imgsNoAlt === 0, String(v.imgsNoAlt));
    record("渲染", `${tag} 表单控件均有标签`, v.unlabeled === 0, String(v.unlabeled));
    record("渲染", `${tag} 产品卡片 7 个`, v.cards === 7, String(v.cards));
    record("渲染", `${tag} 犬猫分组 2 个`, v.groups === 2, String(v.groups));
    record("渲染", `${tag} 语言切换 8 项`, v.switchLinks === LANGS.length, String(v.switchLinks));
    record("渲染", `${tag} 无缺字怀疑字符`, v.suspiciousChars === 0, String(v.suspiciousChars));
    if (lang === "ar") {
      record("RTL", `${tag} 页面 RTL`, v.dir === "rtl");
      record(
        "RTL",
        `${tag} 电话数字保持 LTR`,
        v.tels.length > 0 && v.tels.filter((t) => /\d/.test(t.text)).every((t) => t.dir === "ltr") && v.tels.some((t) => /\+998/.test(t.text)),
        `${v.tels.length} 个电话链接`
      );
    }
    if (lang !== "zh") record("渲染", `${tag} 无中文残留`, !hasCJK(v.title + " " + (await evaluate("document.body.innerText"))));
  }
}

ws.close();
chrome.kill();

mkdirSync(path.join(ROOT, "output/evidence"), { recursive: true });
const failed = results.filter((r) => !r.pass);
writeFileSync(
  path.join(ROOT, "output/evidence/qa-multilingual.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, langs: LANGS, themes: THEMES, total: results.length, failed: failed.length, results }, null, 2)
);
console.log(`=== 多语言检查：${results.length} 项，失败 ${failed.length} 项 ===`);
if (failed.length) {
  const groups = {};
  for (const f of failed) groups[f.group] = (groups[f.group] || 0) + 1;
  console.log("失败分布:", JSON.stringify(groups));
}
process.exit(failed.length ? 2 : 0);
