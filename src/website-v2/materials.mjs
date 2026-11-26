import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const MEDIA = path.join(ROOT, "media");
const OUT = path.join(ROOT, "output/evidence/materials.json");

const SKU = [
  ["全猫鸡肉", "all-age-cat-chicken", "cat"],
  ["全猫牛肉", "all-age-cat-beef", "cat"],
  ["幼猫鸡肉", "kitten-chicken", "cat"],
  ["全犬鸡肉", "all-age-dog-chicken", "dog"],
  ["全犬牛肉", "all-age-dog-beef", "dog"],
  ["小犬鸡肉", "small-dog-chicken", "dog"],
  ["小犬牛肉", "small-dog-beef", "dog"]
];
const EVIDENCE_BY_PATH = [
  ["品牌资料/purepawlogo", "logo-official"],
  ["包装资料/狗/", "packaging-docx-19"],
  ["业务资料/purapaw产品条形码", "barcode-registration"],
  ["业务资料/pure paw nutrion", "state-registration"],
  ["业务资料/益宠调味料宣传册", "brochure-image-pdf"],
  ["设备铭牌/", "equipment-nameplates"]
];

const walk = async (dir) => {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
};

const docxMeta = (file) => {
  try {
    const xml = execFileSync("unzip", ["-p", file, "docProps/core.xml"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    const pick = (tag) => (xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)) || [])[1] || null;
    return {
      title: pick("dc:title"),
      creator: pick("dc:creator"),
      lastModifiedBy: pick("cp:lastModifiedBy"),
      created: pick("dcterms:created"),
      modified: pick("dcterms:modified")
    };
  } catch {
    return null;
  }
};

const evidence = JSON.parse(await readFile(path.join(__dirname, "content/evidence.json"), "utf-8"));
const evidenceById = Object.fromEntries(evidence.items.map((i) => [i.id, i]));

const files = [];
for (const file of (await walk(MEDIA)).sort()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const st = await stat(file);
  const buf = await readFile(file);
  const name = path.basename(file);
  const skuHit = SKU.find(([zh]) => name.includes(zh));
  const sizeHit = name.match(/(\d+(?:\.\d+)?)(?=kg|-文字)/i);
  const evHit = EVIDENCE_BY_PATH.find(([frag]) => rel.includes(frag));
  const ev = evHit ? evidenceById[evHit[1]] : null;
  files.push({
    path: rel,
    type: path.extname(file).slice(1).toLowerCase(),
    size: st.size,
    modified: st.mtime.toISOString(),
    sha256: createHash("sha256").update(buf).digest("hex"),
    sku: skuHit ? skuHit[1] : null,
    sizeKg: sizeHit ? Number(sizeHit[1]) : null,
    docx: rel.endsWith(".docx") ? docxMeta(file) : null,
    evidenceId: ev ? ev.id : null,
    status: ev ? ev.status : null,
    publicUse: ev ? ev.publicUse : null,
    finalApproved: false,
    conflicts: []
  });
}

const bySku = {};
for (const f of files.filter((f) => f.sku)) {
  (bySku[f.sku] ||= []).push({ sizeKg: f.sizeKg, path: f.path, modified: f.docx && f.docx.modified });
}
for (const f of files) {
  if (f.evidenceId === "packaging-docx-19" && f.type === "docx") {
    const text = await readFile(path.join(ROOT, "data/extracted/packaging", f.path.split("/").pop().replace(/\.docx$/, ".txt").replace(/\((\d)\)/, "_$1_")), "utf-8").catch(() => "");
    if (text.includes("100--125")) f.conflicts.push("100--125g 双连字符");
  }
}

const summary = {
  scannedAt: new Date().toISOString(),
  root: "media/",
  totalFiles: files.length,
  byType: files.reduce((m, f) => ((m[f.type] = (m[f.type] || 0) + 1), m), {}),
  bySku: Object.fromEntries(Object.entries(bySku).map(([k, v]) => [k, v.sort((a, b) => a.sizeKg - b.sizeKg)])),
  files
};
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(summary, null, 2), "utf-8");

console.log(`盘点 ${files.length} 个文件，类型：${Object.entries(summary.byType).map(([k, v]) => `${k}×${v}`).join(" ")}`);
for (const [sku, list] of Object.entries(summary.bySku)) {
  console.log(`${sku}: ${list.map((x) => x.sizeKg + "kg").join(" / ")}（${list.length} 个稿）`);
}
const conflicts = files.filter((f) => f.conflicts.length);
console.log(conflicts.length ? `发现 ${conflicts.length} 个文件含 100--125g：${conflicts.map((f) => f.path).join("、")}` : "未发现 100--125g");
console.log(`清单 -> ${path.relative(ROOT, OUT)}`);
