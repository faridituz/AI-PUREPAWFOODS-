import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./core/content.mjs";
import { buildPages, PAGE_RELS } from "./core/pages.mjs";
import { pagePath, escAttr, esc, layout } from "./core/html.mjs";
import { validateLead } from "./core/validate.mjs";
import { checkRelease } from "./core/release-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const RELEASE = args.includes("--release");
const OUT_ROOT = path.resolve(__dirname, getArg("--out", RELEASE ? "../../output/release" : "../../output/prototypes"));
const ORIGIN = getArg("--origin", RELEASE ? "" : "http://localhost:4173");
const NOINDEX = RELEASE ? false : !args.includes("--index");
const ONLY = RELEASE ? "d" : getArg("--theme", "");

const THEMES = [
  { key: "a", label: "A · 国际高端品牌型" },
  { key: "b", label: "B · 信任与咨询转化型" },
  { key: "c", label: "C · 国际品牌与招商综合型" },
  { key: "d", label: "D · 国际品牌与销售转化综合版" }
].filter((t) => !ONLY || t.key === ONLY);

const content = await loadContent();

if (RELEASE) {
  const gate = checkRelease(content, { origin: ORIGIN });
  const reportPath = path.resolve(__dirname, "../../output/evidence/release-gate.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(gate, null, 2), "utf-8");
  console.log(`正式构建门禁：${gate.checks.length} 项，通过 ${gate.checks.filter((c) => c.pass).length} 项`);
  for (const c of gate.checks) console.log(`${c.pass ? "通过" : "阻断"}  ${c.label}${c.pass ? "" : " —— " + c.detail}`);
  if (!gate.pass) {
    console.error(`正式构建已阻断：${gate.blockers.length} 项未满足，未生成任何发布文件。门禁报告 -> ${reportPath}`);
    process.exit(1);
  }
}

const formJsTemplate = await readFile(path.join(__dirname, "assets/form.js"), "utf-8");
const formJs = formJsTemplate.replace("/*__VALIDATE__*/", validateLead.toString());

const builtAt = new Date().toISOString();
const manifest = { builtAt, origin: ORIGIN, noindex: NOINDEX, langs: content.LANGS, totalPages: 0, themes: [] };

for (const theme of THEMES) {
  const outDir = path.join(OUT_ROOT, theme.key);
  const assetsDir = path.join(outDir, "assets");
  const ctx = { ...content, THEME: theme.key, BASE: "/" + theme.key, ORIGIN, NOINDEX, RELEASE };

  await rm(outDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });
  await copyAssets(ctx, assetsDir);

  const pages = buildPages(ctx);
  for (const page of pages) {
    const dir = path.join(outDir, page.lang, ...page.rel.split("/").filter(Boolean));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), page.html, "utf-8");
  }

  await mkdir(path.join(outDir, "errors"), { recursive: true });
  for (const lang of content.LANGS) {
    const e = content.ERRORS[lang];
    const html = layout(ctx, {
      lang,
      rel: "",
      active: "",
      title: `${e.title} — PURE PAW`,
      description: e.body,
      body: `<section class="page-hero">
  <p class="eyebrow">404</p>
  <h1>${esc(e.title)}</h1>
  <p class="lead">${esc(e.body)}</p>
  <p class="actions"><a class="btn btn-solid" href="${pagePath(ctx, lang)}">${esc(e.home)}</a></p>
</section>`
    });
    await writeFile(path.join(outDir, "errors", `${lang}.html`), html, "utf-8");
  }

  const urls = [];
  for (const lang of content.LANGS) {
    for (const rel of PAGE_RELS) urls.push(`${ORIGIN}${pagePath(ctx, lang, rel)}`);
  }
  await writeFile(
    path.join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escAttr(u)}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
    "utf-8"
  );
  const robotsText = NOINDEX
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/${theme.key}/sitemap.xml\n`;
  await writeFile(path.join(outDir, "robots.txt"), robotsText, "utf-8");
  await writeFile(
    path.join(outDir, "build.json"),
    JSON.stringify({ theme: theme.key, label: theme.label, builtAt, pages: pages.length, errorPages: content.LANGS.length, langs: content.LANGS, origin: ORIGIN, noindex: NOINDEX }, null, 2),
    "utf-8"
  );

  manifest.themes.push({ key: theme.key, label: theme.label, pages: pages.length, url: `${ORIGIN}/${theme.key}/${content.DEFAULT_LANG}/` });
  manifest.totalPages += pages.length;
  console.log(`原型 ${theme.key.toUpperCase()}：${pages.length} 页 -> ${outDir}`);
}

await writeFile(path.join(OUT_ROOT, "build-manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

const statusCounts = {};
for (const item of content.EVIDENCE) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
await writeFile(
  path.join(OUT_ROOT, "content-status.json"),
  JSON.stringify(
    {
      updatedAt: content.PRODUCT_META.updatedAt,
      productsDraft: content.PRODUCT_META.draft,
      productsPublicApproved: content.PRODUCT_META.publicApproved,
      evidence: statusCounts,
      missing: content.EVIDENCE.filter((i) => i.status === "missing" || i.status === "review").map((i) => ({ id: i.id, title: i.title, status: i.status })),
      conflicts: content.EVIDENCE.filter((i) => i.status === "conflicting").map((i) => i.id),
      logEntries: content.CONTENT_LOG.length
    },
    null,
    2
  ),
  "utf-8"
);

if (!ONLY) {
  const cards = manifest.themes
    .map(
      (t) => `<li><a href="/${t.key}/${content.DEFAULT_LANG}/"><strong>原型 ${escAttr(t.key.toUpperCase())}</strong><br>${escAttr(t.label)}</a><br><small>${t.pages} 页 · /${t.key}/{lang}/</small></li>`
    )
    .join("");
  await writeFile(
    path.join(OUT_ROOT, "index.html"),
    `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>PURE PAW 原型预览</title>
<style>body{font-family:system-ui,sans-serif;background:#f7f3e8;color:#17241c;margin:0;padding:48px 24px}main{max-width:960px;margin:auto}h1{font-family:Georgia,serif;font-weight:500}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}a{display:block;background:#fffdf6;border:1px solid rgba(23,36,28,.16);border-radius:16px;padding:22px;text-decoration:none;color:inherit}small{color:#5b6a5f}p{color:#5b6a5f;font-size:.9rem}</style></head>
<body><main><h1>PURE PAW 官网原型预览</h1><p>仅本地测试环境 · noindex · 不对外开放 · 表单为模拟 API</p><ul>${cards}</ul><p>构建时间 ${escAttr(builtAt)} · 语言 ${content.LANGS.join(" / ")}</p></main></body></html>`,
    "utf-8"
  );
}

console.log(`共 ${manifest.totalPages} 页，清单 -> ${path.join(OUT_ROOT, "build-manifest.json")}`);

async function copyAssets(ctx, assetsDir) {
  await cp(path.join(__dirname, "styles/base.css"), path.join(assetsDir, "base.css"));
  await cp(path.join(__dirname, "styles", `theme-${ctx.THEME}.css`), path.join(assetsDir, "theme.css"));
  await cp(path.join(__dirname, "assets/logo.png"), path.join(assetsDir, "logo.png"));
  await writeFile(path.join(assetsDir, "form.js"), formJs, "utf-8");
}
