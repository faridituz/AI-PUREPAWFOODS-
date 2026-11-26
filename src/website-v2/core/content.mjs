import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = path.join(__dirname, "..", "content");

// 产品顺序是全站唯一事实来源：site.json 中每种语言的 products 必须与此顺序一一对应
export const PRODUCTS = [
  { slug: "all-age-cat-chicken", group: "cat", idx: 0 },
  { slug: "all-age-cat-beef", group: "cat", idx: 1 },
  { slug: "kitten-chicken", group: "cat", idx: 2 },
  { slug: "all-age-dog-chicken", group: "dog", idx: 3 },
  { slug: "all-age-dog-beef", group: "dog", idx: 4 },
  { slug: "small-dog-chicken", group: "dog", idx: 5 },
  { slug: "small-dog-beef", group: "dog", idx: 6 }
];

const readJson = async (name) => JSON.parse(await readFile(path.join(CONTENT_DIR, name), "utf-8"));

export async function loadContent() {
  const [langFile, SITE, uiFile, formsFile, mktFile, errorsFile, productsFile, dFile, evidenceFile, logFile] = await Promise.all([
    readJson("languages.json"),
    readJson("site.json"),
    readJson("ui.json"),
    readJson("forms.json"),
    readJson("marketing.json"),
    readJson("errors.json"),
    readJson("products.json"),
    readJson("d.json"),
    readJson("evidence.json"),
    readJson("content-log.json")
  ]);

  const LANG_LIST = langFile.languages;
  const LANGS = LANG_LIST.filter((l) => l.enabled).map((l) => l.code);
  if (!LANGS.length) throw new Error("languages.json: 没有启用的语言");
  const DEFAULT_LANG = LANGS.includes(langFile.default) ? langFile.default : LANGS[0];

  const LANG_NAMES = Object.fromEntries(LANG_LIST.map((l) => [l.code, l.name]));
  const DIRS = Object.fromEntries(LANG_LIST.map((l) => [l.code, l.dir || "ltr"]));
  const UI = uiFile.ui;
  const FORMS = formsFile.langs;
  const MKT = mktFile.langs;

  for (const code of LANGS) {
    if (!SITE[code]) throw new Error(`site.json 缺少语言 ${code}`);
    if (!UI[code]) throw new Error(`ui.json 缺少语言 ${code}`);
    if (!FORMS[code]) throw new Error(`forms.json 缺少语言 ${code}`);
    if (!MKT[code]) throw new Error(`marketing.json 缺少语言 ${code}`);
    if (!errorsFile.langs[code]) throw new Error(`errors.json 缺少语言 ${code}`);
    if (!dFile.langs || !dFile.langs[code]) throw new Error(`d.json 缺少语言 ${code}`);
    for (const key of ["evidence_title", "evidence_lead", "ev1_title", "ev1_body", "ev2_title", "ev2_body", "ev3_title", "ev3_body", "ev_note"]) {
      if (!dFile.langs[code][key]) throw new Error(`d.json ${code} 缺少 ${key}`);
    }
  }

  const productCount = SITE[LANGS[0]].products.length;
  if (productCount !== PRODUCTS.length) {
    throw new Error(`产品数不一致：site.json=${productCount}，PRODUCTS=${PRODUCTS.length}`);
  }
  for (const code of LANGS) {
    const list = SITE[code].products;
    if (list.length !== PRODUCTS.length) throw new Error(`site.json ${code} 产品数 ${list.length}`);
    list.forEach((p, i) => {
      if (!p.name || !p.net) throw new Error(`site.json ${code} 第 ${i + 1} 个产品缺少名称或净重`);
    });
  }

  // 产品数值为语言无关的唯一事实来源：营养/喂食/动物性原料占比/规格只存 products.json
  const NUTRIENT_KEYS = ["protein", "fat", "fiber", "ash", "moisture", "calcium", "phosphorus", "taurine", "chloride"];
  const PRODUCT_DATA = productsFile.products || {};
  for (const p of PRODUCTS) {
    const d = PRODUCT_DATA[p.slug];
    if (!d) throw new Error(`products.json 缺少产品 ${p.slug}`);
    if (!Array.isArray(d.nutrition) || d.nutrition.length !== NUTRIENT_KEYS.length) {
      throw new Error(`${p.slug}: 营养成分须为 ${NUTRIENT_KEYS.length} 项`);
    }
    if (d.nutrition.map((n) => n.key).join(",") !== NUTRIENT_KEYS.join(",")) {
      throw new Error(`${p.slug}: 营养成分顺序或键名不符`);
    }
    if (d.nutrition.some((n) => !n.value)) throw new Error(`${p.slug}: 营养成分存在空值`);
    const f = d.feeding;
    if (!f || !["weight", "age"].includes(f.kind)) throw new Error(`${p.slug}: 喂食表 kind 非 weight/age`);
    if (!Array.isArray(f.headers) || !f.headers.length || !Array.isArray(f.rows) || !f.rows.length) {
      throw new Error(`${p.slug}: 喂食表缺少表头或数据行`);
    }
    for (const row of f.rows) {
      if (row.length !== f.headers.length || row.some((c) => !c)) throw new Error(`${p.slug}: 喂食表行列数不一致或存在空值`);
    }
    if (!d.animalShare) throw new Error(`${p.slug}: 缺少动物性原料占比`);
    if (!Array.isArray(d.sizes) || !d.sizes.length) throw new Error(`${p.slug}: 缺少规格`);
  }

  // 素材登记表只允许五类状态；每条必须有 id 与标题
  const EVIDENCE_STATUSES = ["verified", "unapproved", "conflicting", "missing", "review"];
  const PUBLIC_USE = ["yes", "no", "fields-only"];
  const EVIDENCE = evidenceFile.items || [];
  const seenIds = new Set();
  for (const item of EVIDENCE) {
    if (!item.id || seenIds.has(item.id)) throw new Error(`evidence.json: id 缺失或重复 ${item.id}`);
    seenIds.add(item.id);
    if (!EVIDENCE_STATUSES.includes(item.status)) throw new Error(`evidence.json: ${item.id} 状态非法`);
    if (!item.title || !item.category) throw new Error(`evidence.json: ${item.id} 缺少标题或分类`);
    if (typeof item.requiredForLaunch !== "boolean") throw new Error(`evidence.json: ${item.id} 缺少 requiredForLaunch`);
    if (!PUBLIC_USE.includes(item.publicUse)) throw new Error(`evidence.json: ${item.id} publicUse 非法`);
  }
  const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
  if (!Array.isArray(logFile.entries) || !logFile.entries.length) throw new Error("content-log.json: 缺少变更记录");
  for (const e of logFile.entries) {
    for (const k of ["date", "type", "summary", "source", "productVersion", "evidenceStatus", "reviewStatus", "approvalStatus", "updatedAt"]) {
      if (!e[k]) throw new Error(`content-log.json: 记录缺少 ${k}`);
    }
    if (!APPROVAL_STATUSES.includes(e.approvalStatus)) throw new Error("content-log.json: approvalStatus 非法");
    if (!Array.isArray(e.languages) || !e.languages.length) throw new Error("content-log.json: 记录缺少适用语言");
  }

  return {
    LANG_LIST,
    LANGS,
    DEFAULT_LANG,
    LANG_NAMES,
    UI,
    UI_META: uiFile.meta,
    SITE,
    FORMS,
    FORMS_META: formsFile.meta,
    MKT,
    MKT_META: mktFile.meta,
    ERRORS: errorsFile.langs,
    PRODUCTS,
    PRODUCT_DATA,
    PRODUCT_META: productsFile.meta,
    D: dFile.langs,
    D_META: dFile.meta,
    EVIDENCE,
    EVIDENCE_META: evidenceFile.meta,
    CONTENT_LOG: logFile.entries,
    dirOf: (code) => DIRS[code] || "ltr",
    nameOf: (code) => LANG_NAMES[code] || code,
    productsOf: (group) => PRODUCTS.filter((p) => p.group === group)
  };
}
