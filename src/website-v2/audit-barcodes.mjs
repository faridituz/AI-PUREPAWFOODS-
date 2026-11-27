import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./core/content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BARCODES = path.join(__dirname, "content/barcodes.json");
const EXTRACTED = path.join(ROOT, "data/extracted/barcodes.txt");
const OUT_JSON = path.join(ROOT, "output/evidence/barcodes.json");
const OUT_MD = path.join(ROOT, "output/V2.7_条码核对表_20261127.md");

const checkDigit = (code12) => {
  const digits = code12.split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
};

const registration = JSON.parse(await readFile(BARCODES, "utf-8"));
const content = await loadContent();
const products = { products: content.PRODUCT_DATA };
const site = content.SITE;
const idxOf = Object.fromEntries(content.PRODUCTS.map((p) => [p.slug, p.idx]));

const ageOf = (slug) => (slug.startsWith("kitten") ? "幼猫（注册名含孕哺猫，待确认）" : slug.startsWith("small-dog") ? "小型犬（年龄适用范围待确认）" : "全龄");
const petOf = (slug) => (slug.includes("cat") ? "猫" : "犬");
const flavorOf = (slug) => (slug.includes("beef") ? "牛肉" : "鸡肉");

const extracted = await readFile(EXTRACTED, "utf-8");
const extractedByEntry = new Map();
for (const block of extracted.split(/\bGTIN\b/)) {
  const ean = block.match(/EAN-13\s+(\d{13})/);
  const id = block.match(/(\d+)\s*:\s*10000522/);
  if (ean && id) extractedByEntry.set(Number(id[1]), ean[1]);
}

const rows = [];
const warnings = [];
for (const e of registration.entries) {
  const cd = checkDigit(e.ean.slice(0, 12));
  const cdOk = cd === Number(e.ean[12]);
  const fromPdf = extractedByEntry.get(e.entry);
  const pdfOk = fromPdf === e.ean;
  if (!cdOk) warnings.push(`第 ${e.entry} 条校验位错误：${e.ean} 应为 ${e.ean.slice(0, 12)}${cd}`);
  if (fromPdf === undefined) warnings.push(`第 ${e.entry} 条在 PDF 提取稿中未找到，需人工翻查原 PDF`);
  else if (!pdfOk) warnings.push(`第 ${e.entry} 条与 PDF 提取稿不一致：登记=${e.ean} 提取=${fromPdf}`);
  const p = e.sku ? products.products[e.sku] : null;
  const sizeOk = p ? p.sizes.some((s) => s.replace(/\s*kg$/, "") === e.sizeKg) : false;
  if (e.sku && !sizeOk) warnings.push(`第 ${e.entry} 条 ${e.ean} 规格 ${e.sizeKg}kg 不在 ${e.sku} 的规格列表中`);
  rows.push({
    entry: e.entry,
    sku: e.sku || "未分配",
    productNameZh: e.sku ? site.zh.products[idxOf[e.sku]].name : "待确认",
    flavor: e.sku ? flavorOf(e.sku) : "待确认",
    pet: e.sku ? petOf(e.sku) : "待确认",
    age: e.sku ? ageOf(e.sku) : "待确认",
    sizeKg: e.sizeKg,
    ean: e.ean,
    gtinPrefix: e.ean.startsWith(registration.meta.gcp) ? "GCP 一致" : "GCP 不一致",
    source: `GS1 登记 PDF 第 ${e.entry} 条`,
    checkDigitOk: cdOk,
    duplicateInRegistration: false,
    packagingFile: e.packagingFile || "无对应包装数据稿",
    physicalStatus: "未核验",
    approvalStatus: "未批准",
    note: e.note || ""
  });
}

const counts = new Map();
for (const r of rows) counts.set(r.ean, (counts.get(r.ean) || 0) + 1);
const dupes = [...counts.entries()].filter(([, n]) => n > 1);
for (const r of rows) if ((counts.get(r.ean) || 0) > 1) r.duplicateInRegistration = true;

const mappedSizes = new Set(rows.filter((r) => r.sku !== "未分配").map((r) => `${r.sku}|${r.sizeKg}`));
const missingSizes = [];
for (const [slug, p] of Object.entries(products.products)) {
  for (const s of p.sizes) {
    const kg = s.replace(/\s*kg$/, "");
    if (!mappedSizes.has(`${slug}|${kg}`)) missingSizes.push(`${slug} ${s}`);
  }
}

const entryCoverage = { expected: 24, extracted: extractedByEntry.size, json: registration.entries.length };
const hardFail = dupes.length > 0 || rows.some((r) => !r.checkDigitOk) || missingSizes.length > 0 || entryCoverage.extracted !== entryCoverage.expected;

const report = {
  checkedAt: new Date().toISOString(),
  source: registration.meta.source,
  summary: {
    entries: rows.length,
    mapped: rows.filter((r) => r.sku !== "未分配").length,
    unassigned: rows.filter((r) => r.sku === "未分配").length,
    checkDigitInvalid: rows.filter((r) => !r.checkDigitOk).length,
    duplicatesInRegistration: dupes.length,
    productSizes: Object.values(products.products).reduce((n, p) => n + p.sizes.length, 0),
    sizesWithoutBarcode: missingSizes.length,
    extractedEntries: entryCoverage.extracted
  },
  unassigned: rows.filter((r) => r.sku === "未分配").map((r) => ({ entry: r.entry, ean: r.ean, sizeKg: r.sizeKg })),
  missingSizes,
  warnings,
  approvalStatus: "unapproved",
  physicalChecked: false,
  rows
};

await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(report, null, 2), "utf-8");

const md = `# V2.7 条码核对表（Codex 产品主数据审核材料）

- 生成时间：${report.checkedAt}
- 数据源：${registration.meta.source}
- GCP：${registration.meta.gcp}；GLN：${registration.meta.gln}；持有人：${registration.meta.holder}
- 登记文件共 **${rows.length}** 条 GTIN；已映射 SKU 规格 **${report.summary.mapped}** 条；未映射 **${report.summary.unassigned}** 条；校验位错误 **${report.summary.checkDigitInvalid}** 条；登记文件内重复 **${dupes.length}** 条。
- 产品规格共 ${report.summary.productSizes} 个，无条码映射 ${missingSizes.length} 个。
- **全部条码与产品对应关系保持未批准、未实物核验。校验位正确不代表条码已合法分配或对应关系正确。**

| 序号 | 内部 SKU | 产品名称 | 口味 | 宠物 | 适用年龄 | 规格 | GTIN/EAN | 条码来源 | 校验位 | 重复 | 包装文件 | 实物核验 | 审批 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (r) =>
      `| ${r.entry} | ${r.sku} | ${r.productNameZh} | ${r.flavor} | ${r.pet} | ${r.age} | ${r.sizeKg} kg | ${r.ean} | ${r.source} | ${r.checkDigitOk ? "正确" : "错误"} | ${r.duplicateInRegistration ? "重复" : "唯一"} | ${path.relative(ROOT, r.packagingFile).replace(/\\/g, "/")} | ${r.physicalStatus} | ${r.approvalStatus} | ${r.note || ""} |`
  )
  .join("\n")}

## 未映射条目（登记表有、包装数据稿未使用）

${report.unassigned.map((u) => `- 第 ${u.entry} 条 ${u.ean}，${u.sizeKg} kg`).join("\n") || "无"}

这些号码可能是旧版、未上市规格或另一个产品的登记，需品牌方对照 GS1 账户确认；在确认前不得印刷、不得新增分配。

## 已知冲突

- 4780178200193：登记文件内仅出现一次（第 19 条，小犬牛肉 1.5kg），但全犬鸡肉 1.5kg 的 PSD 合成图曾显示同一号码；包装核对清单登记全犬鸡肉 1.5kg 为 4780178200162。两块条码印刷前必须对照登记文件与实物确认。
- ${missingSizes.length ? "缺失映射：" + missingSizes.join("、") : "SKU 规格与条码映射数量一致。"}

## 警告

${warnings.map((w) => `- ${w}`).join("\n") || "无（24 条与 PDF 提取稿逐条一致）"}
`;
await writeFile(OUT_MD, md, "utf-8");

console.log(`条码核对：${rows.length} 条，映射 ${report.summary.mapped}，未映射 ${report.summary.unassigned}，校验位错误 ${report.summary.checkDigitInvalid}，登记内重复 ${dupes.length}，规格缺映射 ${missingSizes.length}`);
for (const w of warnings) console.log(`警告  ${w}`);
console.log(`报告 -> ${path.relative(ROOT, OUT_JSON)}；表格 -> ${path.relative(ROOT, OUT_MD)}`);
process.exit(hardFail ? 1 : 0);
