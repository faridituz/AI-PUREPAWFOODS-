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
  const [langFile, SITE, uiFile, formsFile, mktFile, errorsFile] = await Promise.all([
    readJson("languages.json"),
    readJson("site.json"),
    readJson("ui.json"),
    readJson("forms.json"),
    readJson("marketing.json"),
    readJson("errors.json")
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
    dirOf: (code) => DIRS[code] || "ltr",
    nameOf: (code) => LANG_NAMES[code] || code,
    productsOf: (group) => PRODUCTS.filter((p) => p.group === group)
  };
}
