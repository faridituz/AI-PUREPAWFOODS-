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
const BASE = argOf("--base", "http://localhost:4173");
const THEMES = argOf("--themes", "a,b,c,d").split(",").filter(Boolean);
const readJson = (p) => JSON.parse(readFileSync(p, "utf-8"));
const LANGS = readJson(path.join(__dirname, "content/languages.json")).languages.filter((l) => l.enabled).map((l) => l.code);
const DATA = readJson(path.join(__dirname, "content/products.json")).products;
const meta = readJson(path.join(__dirname, "content/products.json")).meta;

const results = [];
const record = (group, name, pass, detail = "") => {
  results.push({ group, name, pass, detail });
  if (!pass) console.log(`失败 [${group}] ${name} ${detail}`);
};

const unescape = (s) =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const pageUrl = (theme, lang, rel) => `${BASE}/${theme}/${lang}/${rel ? rel + "/" : ""}`;

function nutritionRows(html) {
  const section = html.split('<section class="section product-data">')[1] || "";
  const first = section.split('<div class="spec-card">')[1]?.split("</table>")[0] || "";
  return [...first.matchAll(/<tr><th scope="row">(.*?)<\/th><td dir="ltr">(.*?)<\/td><\/tr>/g)].map((m) => unescape(m[2]));
}

function feedingRows(html) {
  const section = html.split('<section class="section product-data">')[1] || "";
  const parts = section.split('<div class="spec-card">');
  const second = parts[2]?.split("</table>")[0] || "";
  return [...second.matchAll(/<tr>((?:<td[^>]*>.*?<\/td>)+)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => unescape(c[1]))
  );
}

for (const theme of THEMES) {
  const statusRes = await fetch(`${BASE}/${theme}/build.json`).catch(() => null);
  record("构建", `${theme} build.json 可读`, !!statusRes?.ok);
  const status = readJson(path.join(ROOT, "output/prototypes", theme, "build.json"));

  for (const p of PRODUCTS) {
    const expected = DATA[p.slug];
    const sigs = new Set();
    for (const lang of LANGS) {
      const url = pageUrl(theme, lang, "product/" + p.slug);
      const res = await fetch(url).catch(() => null);
      if (!res?.ok) {
        record("产品页", `${theme}/${lang}/${p.slug} 可访问`, false, String(res?.status || "ERR"));
        continue;
      }
      const html = await res.text();
      const gotN = nutritionRows(html);
      const gotF = feedingRows(html);
      const expN = expected.nutrition.map((n) => n.value);
      const expF = expected.feeding.rows;
      record("营养数据", `${theme}/${lang}/${p.slug} 9 项一致`, JSON.stringify(gotN) === JSON.stringify(expN), JSON.stringify(gotN));
      record("喂食数据", `${theme}/${lang}/${p.slug} 行一致`, JSON.stringify(gotF) === JSON.stringify(expF), JSON.stringify(gotF));
      record("规格", `${theme}/${lang}/${p.slug} 规格与占比`, html.includes(expected.sizes.join(" / ")) && html.includes(expected.animalShare));
      record("过渡", `${theme}/${lang}/${p.slug} 7 天过渡`, (html.match(/<div class="transition">[\s\S]*?<\/ol>/) || [""])[0].split("<li>").length === 5);
      const sig = JSON.stringify([gotN, gotF]);
      sigs.add(sig);
      record("数据唯一来源", `${theme}/${p.slug} 与 products.json 一致`, sig === JSON.stringify([expN, expF]));
    }
    record("跨语言一致", `${theme}/${p.slug} 8 语言同一组数值`, sigs.size === 1, `签名种类 ${sigs.size}`);
    record("构建标记", `${theme} 仍为未批准草稿`, status.noindex === true);
  }

  for (const lang of LANGS) {
    const res = await fetch(pageUrl(theme, lang, "brand")).catch(() => null);
    const html = res?.ok ? await res.text() : "";
    record("企业信息", `${theme}/${lang} STIR/GCP/GLN`, ["313 101 809", "478017820", "4780178209998"].every((v) => html.includes(v)));
    for (const rel of ["", "brand", "contact", "partners", ...PRODUCTS.map((p) => "product/" + p.slug)]) {
      const r = await fetch(pageUrl(theme, lang, rel)).catch(() => null);
      const h = r?.ok ? await r.text() : "";
      record("真实性扫描", `${theme}/${lang}/${rel || "home"} 无认证类虚标`, !/halal|халял|حلال|清真认证/i.test(h));
      record("真实性扫描", `${theme}/${lang}/${rel || "home"} 无喂食笔误`, !/100--125/.test(h));
    }
  }
}

record("数据管理", "products.json 标记为草稿且未批准公开", meta.draft === true && meta.publicApproved === false);
record("数据管理", "冲突记录存在", Array.isArray(meta.conflicts) && meta.conflicts.length > 0);
const statusFile = readJson(path.join(ROOT, "output/prototypes/content-status.json"));
record("数据管理", "content-status.json 待办清单存在", Array.isArray(statusFile.missing) && statusFile.missing.length > 0);
record("数据管理", "证据登记五类齐全", Object.keys(statusFile.evidence).sort().join(",") === "conflicting,missing,review,unapproved,verified");

const langMeta = readJson(path.join(__dirname, "content/languages.json")).languages;
const enabled = langMeta.filter((l) => l.enabled);
record("语言治理", "启用 8 种、停用 2 种", enabled.length === 8 && langMeta.filter((l) => !l.enabled).length === 2);
record("语言治理", "8 种启用语言均为原站语言", enabled.every((l) => l.origin === "live-site" && l.publicApproved === true));
record("语言治理", "en/ru/uz 文案为官方来源", ["en", "ru", "uz"].every((c) => langMeta.find((l) => l.code === c)?.translation === "official"));
record("语言治理", "zh/ar/kk/ky/tg 文案仍为草稿", ["zh", "ar", "kk", "ky", "tg"].every((c) => langMeta.find((l) => l.code === c)?.translation === "prototype-draft"));
const disabledChecks = await Promise.all(
  langMeta.filter((l) => !l.enabled).map(async (l) => (await fetch(`${BASE}/a/${l.code}/`).catch(() => null))?.status === 404)
);
record("语言治理", "停用语言不生成页面", disabledChecks.every(Boolean));

const failed = results.filter((r) => !r.pass);
mkdirSync(path.join(ROOT, "output/evidence"), { recursive: true });
writeFileSync(
  path.join(ROOT, "output/evidence/qa-data.json"),
  JSON.stringify({ base: BASE, themes: THEMES, langs: LANGS, total: results.length, failed: failed.length, results }, null, 2),
  "utf-8"
);
console.log(`数据一致性检查：${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 2 : 0);
