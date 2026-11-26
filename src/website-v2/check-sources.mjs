import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "data/extracted/packaging");
const OUT = path.join(ROOT, "output/evidence/source-check.json");

const SKU_OF = {
  "全猫鸡肉": "all-age-cat-chicken",
  "全猫牛肉": "all-age-cat-beef",
  "幼猫鸡肉": "kitten-chicken",
  "全犬鸡肉": "all-age-dog-chicken",
  "全犬牛肉": "all-age-dog-beef",
  "小犬鸡肉": "small-dog-chicken",
  "小犬牛肉": "small-dog-beef"
};
const SECTION_MARKERS = [
  ["uz", "乌兹别克语"],
  ["ru", "俄语"],
  ["kk", "哈萨克语"],
  ["en", "英语"]
];
const num = (s) => Number(String(s).replace(",", "."));

const sectionOf = (text, i) => {
  const start = text.indexOf(SECTION_MARKERS[i][1]);
  const end = i + 1 < SECTION_MARKERS.length ? text.indexOf(SECTION_MARKERS[i + 1][1]) : text.length;
  return start < 0 ? "" : text.slice(start, end < 0 ? text.length : end);
};

const weightRows = (section) => {
  const rowRe = /(?:(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)|≥\s*(\d+(?:[.,]\d+)?))\s*kg\s*\n\s*(\d+(?:\.\d+)?)\s*[–-]+\s*(\d+(?:\.\d+)?)\s*g\s*\n\s*(\d+(?:\.\d+)?)\s*[–-]+\s*(\d+(?:\.\d+)?)\s*g/gi;
  return [...section.matchAll(rowRe)].map((m) => [num(m[1] || m[3]), m[2] ? num(m[2]) : null, num(m[4]), num(m[5]), num(m[6]), num(m[7])]);
};
const expectRows = (prod) =>
  prod.feeding.rows.map((r) =>
    r.map((c) => {
      if (/≥/.test(c)) return [num(c.match(/\d+(?:[.,]\d+)?/)[0]), null];
      const ns = c.match(/\d+(?:[.,]\d+)?/g) || [];
      return ns.slice(0, 2).map(num);
    }).flat().slice(0, prod.feeding.kind === "age" ? 4 : 6)
  );
const ageRows = (section) => {
  const re = /^(\d+)\s*[–-]\s*(\d+)\s*\n\s*(\d+(?:\.\d+)?)\s*[–-]+\s*(\d+(?:\.\d+)?)\s*g/gim;
  return [...section.matchAll(re)].map((m) => m.slice(1, 5).map(num));
};
const nutritionOf = (section) =>
  [...section.matchAll(/([≥≤])\s*(\d+(?:\.\d+)?)\s*%/g)].map((m) => `${m[1]}${parseFloat(m[2])}`);

const productsFile = JSON.parse(await readFile(path.join(__dirname, "content/products.json"), "utf-8"));
const checks = [];
const add = (sku, file, label, pass, detail) => checks.push({ sku, file, label, pass, detail });

const files = (await readdir(SRC)).filter((f) => f.endsWith(".txt")).sort();
const bySku = {};
for (const f of files) {
  const zh = Object.keys(SKU_OF).find((k) => f.includes(k));
  if (!zh) continue;
  const sku = SKU_OF[zh];
  const text = await readFile(path.join(SRC, f), "utf-8");
  const prod = productsFile.products[sku];
  (bySku[sku] ||= []).push({ file: f, text });
  if (!prod) {
    add(sku, f, "products.json 存在该 SKU", false, "缺失");
    continue;
  }
  if (/mg\/kg|г\/кг|g\/kg/i.test(text)) add(sku, f, "单位未混用（mg/kg 与 g/kg）", false, "出现 mg/kg 或 g/kg");
  else add(sku, f, "单位未混用（mg/kg 与 g/kg）", true, "仅 % 与 g/天");

  const sectionRows = [];
  for (let i = 0; i < SECTION_MARKERS.length; i++) {
    const sec = sectionOf(text, i);
    const code = SECTION_MARKERS[i][0];
    const rows = prod.feeding.kind === "age" ? ageRows(sec) : weightRows(sec);
    sectionRows.push(rows);
    const expect = expectRows(prod);
    const ok = rows.length === expect.length && rows.every((r, j) => r.every((v, k) => v === expect[j][k]));
    add(sku, f, `${code} 喂食表与 products.json 一致`, ok, ok ? `${rows.length} 行` : `源=${JSON.stringify(rows)} 库=${JSON.stringify(expect)}`);

    const sourceNutrition = nutritionOf(sec);
    const targetNutrition = prod.nutrition.map((n) => {
      const m = n.value.match(/([≥≤])\s*(\d+(?:\.\d+)?)/);
      return `${m[1]}${parseFloat(m[2])}`;
    });
    const sorted = (arr) => [...arr].sort().join(",");
    add(sku, f, `${code} 保证分析值 9 项一致`, sorted(sourceNutrition) === sorted(targetNutrition), `源=${sourceNutrition.join(" ")}`);

    const dailyOk = /[gг]\s*\/\s*(kun|күн|кун|день|day)/i.test(sec);
    add(sku, f, `${code} 标注为每日喂食量`, dailyOk, dailyOk ? "g/天" : "未找到每日量标识");
  }
  const sizeSet = new Set(sectionRows.map((rows) => JSON.stringify(rows)));
  add(sku, f, "四语喂食表一致", sizeSet.size === 1, `${sizeSet.size} 种写法`);

  const share = text.match(/(\d+)%/);
  add(sku, f, "动物性原料占比与 products.json 一致", share && share[1] + "%" === prod.animalShare, `源=${share ? share[1] + "%" : "无"} 库=${prod.animalShare}`);
  if (text.includes("--")) add(sku, f, "无 100--125g 双连字符", false, "存在双连字符");
}

for (const [sku, list] of Object.entries(bySku)) {
  const sig = new Set(list.map(({ text, file }) => {
    const prod = productsFile.products[sku];
    return JSON.stringify(sectionRowsOf(text, prod));
  }));
  add(sku, "全规格", "同一 SKU 不同规格数据一致", sig.size === 1, `${list.length} 个文件，${sig.size} 种数据`);
}

function sectionRowsOf(text, prod) {
  return SECTION_MARKERS.map((_, i) => {
    const sec = sectionOf(text, i);
    return prod.feeding.kind === "age" ? ageRows(sec) : weightRows(sec);
  });
}

const signature = (sku) => JSON.stringify(productsFile.products[sku].feeding.rows);
const dupes = {};
for (const sku of Object.keys(productsFile.products)) (dupes[signature(sku)] ||= []).push(sku);
const sharedTables = Object.values(dupes).filter((g) => g.length > 1);

const failed = checks.filter((c) => !c.pass);
const report = {
  checkedAt: new Date().toISOString(),
  source: "data/extracted/packaging/*.txt（由 media/包装资料/狗/*.docx 提取）",
  checks: checks.length,
  failed: failed.length,
  sharedFeedingTables: sharedTables,
  files: files.length,
  results: checks
};
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), "utf-8");
console.log(`数据反向核验：${checks.length} 项，失败 ${failed.length} 项；文件 ${files.length} 个`);
for (const f of failed) console.log(`失败  ${f.sku} / ${f.file} / ${f.label}：${f.detail}`);
console.log(`多 SKU 共用同一喂食表：${sharedTables.map((g) => g.join("+")).join("；") || "无"}`);
console.log(`报告 -> ${path.relative(ROOT, OUT)}`);
process.exit(failed.length ? 1 : 0);
