import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TARGET = path.resolve(ROOT, process.argv[2] || "output/release");
const OUT = path.join(ROOT, "output/evidence/qa-release.json");

const walk = async (dir) => {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
};

const RULES = [
  { id: "noindex", label: "无 noindex 指令", re: /<meta name="robots" content="noindex/i },
  { id: "prototype-attr", label: "无 data-prototype 标记", re: /data-prototype=/ },
  { id: "proto-note", label: "无原型角标", re: /class="proto-note"/ },
  { id: "prototype-word", label: "无 prototype/原型/模拟 字样", re: /prototype|прототип|prototip|نموذج[^.]{0,20}أولي|原型|模拟/i },
  { id: "mock", label: "无 mock 线索说明", re: /\bmock\b|模拟 API|mock API/i },
  { id: "localhost", label: "无 localhost 引用", re: /localhost|127\.0\.0\.1/ },
  { id: "testdata", label: "无测试数据/测试接口字样", re: /测试数据|测试接口|test[\s-]?data|test[\s-]?api/i },
  { id: "abc-link", label: "无 A/B/C 原型链接", re: /(?:href|src)="\/[abc]\// }
];

const files = (await walk(TARGET)).filter((f) => /\.(html|xml|txt|js|json|css)$/i.test(f));
const hits = {};
for (const rule of RULES) hits[rule.id] = [];
for (const f of files) {
  const text = await readFile(f, "utf-8");
  for (const rule of RULES) {
    if (rule.re.test(text)) hits[rule.id].push(path.relative(ROOT, f).replace(/\\/g, "/"));
  }
}

const htmls = files.filter((f) => f.endsWith(".html"));
const errPages = htmls.filter((f) => /errors[\\/][a-z]{2}\.html$/.test(f));
const sitemapPath = path.join(TARGET, "sitemap.xml");
const sitemap = await readFile(sitemapPath, "utf-8").catch(() => "");
const sitemapLangs = [...sitemap.matchAll(/\/([a-z]{2,3})\/[^<]*<\/loc>/g)].map((m) => m[1]);
const robots = await readFile(path.join(TARGET, "robots.txt"), "utf-8").catch(() => "");

const checks = [
  { id: "pages", label: "内容页 104（8 语 × 13 类）+ 8 个 404", pass: htmls.length - errPages.length === 104, detail: `${htmls.length - errPages.length} 个内容页` },
  { id: "errors", label: "8 个本地化 404", pass: errPages.length === 8, detail: `${errPages.length} 个` },
  { id: "sitemap", label: "sitemap 仅含 8 种正式语言", pass: ["en", "zh", "ru", "ar", "uz", "kk", "ky", "tg"].every((l) => sitemapLangs.includes(l)) && !sitemapLangs.includes("kaa") && !sitemapLangs.includes("tr"), detail: [...new Set(sitemapLangs)].join("/") },
  { id: "robots", label: "robots 允许抓取并指向 sitemap", pass: /Allow: \//.test(robots) && /Sitemap: https:\/\//.test(robots), detail: robots.split("\n")[0] || "缺失" }
];
for (const rule of RULES) {
  checks.push({ id: rule.id, label: rule.label, pass: hits[rule.id].length === 0, detail: hits[rule.id].length ? `${hits[rule.id].length} 个文件，例：${hits[rule.id][0]}` : "通过" });
}

const failed = checks.filter((c) => !c.pass);
const report = { checkedAt: new Date().toISOString(), target: path.relative(ROOT, TARGET), files: files.length, checks, failed: failed.length, hits };
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), "utf-8");
console.log(`发布包检查：${checks.length} 项，失败 ${failed.length} 项（目标 ${report.target}）`);
for (const c of checks) console.log(`${c.pass ? "通过" : "失败"}  ${c.label} —— ${c.detail}`);
console.log(`报告 -> ${path.relative(ROOT, OUT)}`);
process.exit(failed.length ? 1 : 0);
