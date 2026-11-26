import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const OUT = path.resolve(__dirname, getArg("--out", "../../output/prototypes/a"));
const ORIGIN = getArg("--origin", "http://localhost:4173");
const NOINDEX = !args.includes("--index");

const site = JSON.parse(await readFile(path.join(__dirname, "content/site.json"), "utf-8"));
const uiFile = JSON.parse(await readFile(path.join(__dirname, "content/ui.json"), "utf-8"));
const UI = uiFile.ui;
const LANGS = uiFile.meta.order;
const DEFAULT_LANG = uiFile.meta.default;
const LANG_NAMES = uiFile.meta.names;
const dirOf = (l) => uiFile.meta.dir[l] || "ltr";

const PHONE = "+998 95 826 69 99";
const PHONE_HREF = "tel:+998958266999";
const EMAIL = "farid.it.uz@gmail.com";
const WHATSAPP = "https://wa.me/998999876888";

const products = [
  { slug: "all-age-cat-chicken", group: "cat", idx: 0 },
  { slug: "all-age-cat-beef", group: "cat", idx: 1 },
  { slug: "kitten-chicken", group: "cat", idx: 2 },
  { slug: "all-age-dog-chicken", group: "dog", idx: 3 },
  { slug: "all-age-dog-beef", group: "dog", idx: 4 },
  { slug: "small-dog-chicken", group: "dog", idx: 5 },
  { slug: "small-dog-beef", group: "dog", idx: 6 }
];

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escAttr = esc;
const withLineBreaks = (s = "") => esc(s).split("\n").join("<br>");

function pagePath(lang, rel = "") {
  return `/a/${lang}/${rel ? rel + "/" : ""}`;
}

function alternates(lang, rel) {
  const links = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}${pagePath(l, rel)}">`
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath(DEFAULT_LANG, rel)}">`);
  links.push(`<link rel="canonical" href="${ORIGIN}${pagePath(lang, rel)}">`);
  return links.join("\n");
}

function langSwitch(lang, rel) {
  const items = LANGS.map((l) => {
    const active = l === lang ? ' aria-current="true" class="is-active"' : "";
    return `<a${active} href="${pagePath(l, rel)}" hreflang="${l}" lang="${l}" dir="${dirOf(l)}">${esc(LANG_NAMES[l])}</a>`;
  }).join("");
  return `<details class="lang-switch">
  <summary aria-label="${escAttr(UI[lang].lang)}"><span class="globe" aria-hidden="true">◎</span> ${esc(LANG_NAMES[lang])}</summary>
  <div class="lang-menu" role="group" aria-label="${escAttr(UI[lang].lang)}">${items}</div>
</details>`;
}

function header(lang, rel, active) {
  const t = UI[lang];
  const nav = [
    ["", "nav_home"],
    ["cat", "nav_cat"],
    ["dog", "nav_dog"],
    ["brand", "nav_brand"],
    ["partners", "nav_partners"],
    ["contact", "nav_contact"]
  ]
    .map(([href, key]) => {
      const isActive = active === (href || "home") ? ' aria-current="page"' : "";
      return `<a href="${pagePath(lang, href)}"${isActive}>${esc(t[key])}</a>`;
    })
    .join("");
  return `<header class="site-head">
  <a class="skip" href="#main">${esc(t.skip)}</a>
  <div class="head-inner">
    <a class="wordmark" href="${pagePath(lang)}" aria-label="PURE PAW">
      <img src="/a/assets/logo.png" alt="PURE PAW" width="64" height="64">
      <span><strong>PURE PAW</strong><small>PET NUTRITION</small></span>
    </a>
    <nav class="main-nav" aria-label="PURE PAW">${nav}</nav>
    ${langSwitch(lang, rel)}
  </div>
</header>`;
}

function footer(lang) {
  const t = UI[lang];
  return `<footer class="site-foot">
  <div class="foot-inner">
    <div>
      <p class="foot-brand">PURE PAW</p>
      <p>PURE PAW NUTRITION MCHJ<br>Tashkent, Korasuv</p>
    </div>
    <nav aria-label="PURE PAW">
      <a href="${pagePath(lang)}">${esc(t.nav_home)}</a>
      <a href="${pagePath(lang, "cat")}">${esc(t.nav_cat)}</a>
      <a href="${pagePath(lang, "dog")}">${esc(t.nav_dog)}</a>
      <a href="${pagePath(lang, "brand")}">${esc(t.nav_brand)}</a>
      <a href="${pagePath(lang, "partners")}">${esc(t.nav_partners)}</a>
      <a href="${pagePath(lang, "contact")}">${esc(t.nav_contact)}</a>
    </nav>
    <div class="foot-contact">
      <a href="${WHATSAPP}">WhatsApp</a><br>
      <a href="${PHONE_HREF}" dir="ltr">${PHONE}</a><br>
      <a href="mailto:${EMAIL}" dir="ltr">${EMAIL}</a>
    </div>
  </div>
  <p class="proto-note">${esc(t.prototype)}</p>
</footer>`;
}

function layout({ lang, rel, active, title, description, body, bodyClass = "" }) {
  const t = UI[lang];
  return `<!doctype html>
<html lang="${lang}" dir="${dirOf(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(description)}">
${NOINDEX ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${lang}">
<link rel="icon" href="/a/assets/logo.png" type="image/png">
<link rel="stylesheet" href="/a/assets/styles.css">
${alternates(lang, rel)}
</head>
<body class="${bodyClass}">
${header(lang, rel, active)}
<main id="main">
${body}
</main>
${footer(lang)}
</body>
</html>`;
}

const contactBlock = (lang) => {
  const t = UI[lang];
  const c = site[lang];
  return `<section class="contact-band">
  <div>
    <p class="eyebrow">03 / PURE PAW</p>
    <h2>${esc(c.contact_title)}</h2>
    <p>${esc(c.contact_body)}</p>
    <p class="actions">
      <a class="btn btn-solid" href="${WHATSAPP}">${esc(c.cta_whatsapp)}</a>
      <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(c.cta_email)}</a>
    </p>
  </div>
  <address dir="ltr">
    <strong>PURE PAW NUTRITION MCHJ</strong><br>Tashkent, Korasuv<br>
    <a href="${PHONE_HREF}">${PHONE}</a><br>
    <a href="mailto:${EMAIL}">${EMAIL}</a>
  </address>
</section>`;
};

const productCard = (lang, p) => {
  const c = site[lang];
  const prod = c.products[p.idx];
  return `<article class="card">
  <span class="num">${String(p.idx + 1).padStart(2, "0")}</span>
  <h3><a href="${pagePath(lang, "product/" + p.slug)}">${esc(prod.name)}</a></h3>
  <p class="meta">${esc(prod.net)}</p>
  <details>
    <summary>${esc(prod.ingredients_label)}</summary>
    <p><strong>${esc(prod.ingredients_heading)}</strong><br>${esc(prod.ingredients)}</p>
  </details>
  <p class="card-link"><a href="${pagePath(lang, "product/" + p.slug)}">${esc(UI[lang].view_product)} →</a></p>
</article>`;
};

const noteBlock = (lang) => `<p class="note">${esc(site[lang].note)}</p>`;

const sizesOf = (net) => {
  const m = String(net).match(/[:：]\s*(.+)$/);
  return m ? m[1] : net;
};

function homePage(lang) {
  const c = site[lang];
  const t = UI[lang];
  const catCount = products.filter((p) => p.group === "cat").length;
  const dogCount = products.filter((p) => p.group === "dog").length;
  const body = `
<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">PURE PAW / PET NUTRITION</p>
    <h1>${withLineBreaks(c.hero_title)}</h1>
    <p class="lead">${esc(c.hero_lead)}</p>
    <p class="actions">
      <a class="btn btn-solid" href="#ranges">${esc(c.cta_ranges)}</a>
      <a class="btn btn-text" href="${pagePath(lang, "partners")}">${esc(t.nav_partners)} →</a>
    </p>
  </div>
  <div class="hero-seal">
    <img src="/a/assets/logo.png" alt="PURE PAW" width="380" height="380" fetchpriority="high">
  </div>
</section>

<section class="section split">
  <div>
    <p class="eyebrow">01 / ${lang === "ru" ? "Философия" : lang === "en" ? "Our philosophy" : lang === "uz" ? "Falsafamiz" : lang === "ar" ? "فلسفتنا" : lang === "zh" ? "品牌理念" : lang === "kk" ? "Біздің философия" : lang === "ky" ? "Биздин философия" : "Фалсафаи мо"}</p>
    <h2>${esc(c.philosophy_title)}</h2>
  </div>
  <div>
    <p>${esc(c.philosophy_body)}</p>
  </div>
</section>

<section class="section">
  <p class="eyebrow">02 / ${esc(t.home_products)}</p>
  <div class="group-grid">
    <a class="group-card" href="${pagePath(lang, "cat")}">
      <span class="count">0${catCount}</span>
      <h2>${esc(t.nav_cat)}</h2>
      <p>${esc(t.cat_intro)}</p>
      <span class="group-link">${esc(t.view_range)} →</span>
    </a>
    <a class="group-card" href="${pagePath(lang, "dog")}">
      <span class="count">0${dogCount}</span>
      <h2>${esc(t.nav_dog)}</h2>
      <p>${esc(t.dog_intro)}</p>
      <span class="group-link">${esc(t.view_range)} →</span>
    </a>
  </div>
</section>

<section class="section" id="ranges">
  <p class="eyebrow">03 / ${esc(c.ranges_title)}</p>
  <h2>${esc(c.ranges_title)}</h2>
  <div class="cards">
    ${products.map((p) => productCard(lang, p)).join("\n")}
  </div>
  ${noteBlock(lang)}
</section>

${contactBlock(lang)}`;
  return layout({
    lang,
    rel: "",
    active: "home",
    title: "PURE PAW — " + c.hero_title.replace(/\n/g, " "),
    description: c.hero_lead,
    body
  });
}

function groupPage(lang, group) {
  const t = UI[lang];
  const list = products.filter((p) => p.group === group);
  const heading = group === "cat" ? t.nav_cat : t.nav_dog;
  const intro = group === "cat" ? t.cat_intro : t.dog_intro;
  const body = `
<section class="page-hero">
  <p class="eyebrow">PURE PAW / ${esc(heading)}</p>
  <h1>${esc(heading)}</h1>
  <p class="lead">${esc(intro)}</p>
</section>
<section class="section">
  <div class="cards">
    ${list.map((p) => productCard(lang, p)).join("\n")}
  </div>
  ${noteBlock(lang)}
</section>
${contactBlock(lang)}`;
  return layout({
    lang,
    rel: group,
    active: group,
    title: `${heading} — PURE PAW`,
    description: intro,
    body
  });
}

function productPage(lang, p) {
  const prod = site[lang].products[p.idx];
  const t = UI[lang];
  const groupLabel = p.group === "cat" ? t.nav_cat : t.nav_dog;
  const siblings = products.filter((x) => x.group === p.group && x.slug !== p.slug);
  const body = `
<section class="product-hero">
  <p class="eyebrow"><a href="${pagePath(lang, p.group)}">${esc(groupLabel)}</a> / ${String(p.idx + 1).padStart(2, "0")}</p>
  <h1>${esc(prod.name)}</h1>
  <p class="lead">${esc(prod.net)}</p>
</section>
<section class="section product-body">
  <div class="spec-card">
    <p class="eyebrow">${esc(prod.ingredients_heading)}</p>
    <p>${esc(prod.ingredients)}</p>
    <p class="note">${esc(site[lang].note)}</p>
  </div>
  <aside class="spec-side">
    <p class="eyebrow">${esc(t.sizes)}</p>
    <p class="size-line">${esc(sizesOf(prod.net))}</p>
    <p class="actions">
      <a class="btn btn-solid" href="${WHATSAPP}">${esc(prod.ask)}</a>
      <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(site[lang].cta_email)}</a>
    </p>
  </aside>
</section>
<section class="section">
  <p class="eyebrow">${esc(t.more_from)}</p>
  <div class="cards cards-small">
    ${siblings
      .map(
        (s) => `<article class="card">
      <h3><a href="${pagePath(lang, "product/" + s.slug)}">${esc(site[lang].products[s.idx].name)}</a></h3>
      <p class="meta">${esc(site[lang].products[s.idx].net)}</p>
      <p class="card-link"><a href="${pagePath(lang, "product/" + s.slug)}">${esc(t.view_product)} →</a></p>
    </article>`
      )
      .join("\n")}
  </div>
  <p><a class="btn btn-text" href="${pagePath(lang, p.group)}">← ${esc(t.back)}</a></p>
</section>
${contactBlock(lang)}`;
  return layout({
    lang,
    rel: "product/" + p.slug,
    active: p.group,
    title: `${prod.name} — PURE PAW`,
    description: `${prod.name}. ${prod.net}. ${prod.ingredients}`,
    body
  });
}

function brandPage(lang) {
  const c = site[lang];
  const t = UI[lang];
  const body = `
<section class="page-hero">
  <p class="eyebrow">PURE PAW / ${esc(t.nav_brand)}</p>
  <h1>${esc(c.philosophy_title)}</h1>
  <p class="lead">${esc(c.hero_lead)}</p>
</section>
<section class="section split">
  <div><p class="eyebrow">01 / PURE PAW</p><h2>${esc(t.nav_brand)}</h2></div>
  <div><p>${esc(c.philosophy_body)}</p></div>
</section>
<section class="section">
  <p class="eyebrow">02 / ${esc(t.brand_company)}</p>
  <div class="spec-card">
    <p><strong>PURE PAW NUTRITION MCHJ</strong><br>Tashkent, Korasuv</p>
    <p dir="ltr"><a href="${PHONE_HREF}">${PHONE}</a><br><a href="mailto:${EMAIL}">${EMAIL}</a></p>
  </div>
  <p class="actions">
    <a class="btn btn-solid" href="${pagePath(lang, "cat")}">${esc(t.nav_cat)} →</a>
    <a class="btn btn-ghost" href="${pagePath(lang, "dog")}">${esc(t.nav_dog)} →</a>
  </p>
</section>
${contactBlock(lang)}`;
  return layout({
    lang,
    rel: "brand",
    active: "brand",
    title: `${t.nav_brand} — PURE PAW`,
    description: c.philosophy_body,
    body
  });
}

function partnersPage(lang) {
  const t = UI[lang];
  const body = `
<section class="page-hero">
  <p class="eyebrow">PURE PAW / B2B</p>
  <h1>${esc(t.partner_title)}</h1>
  <p class="lead">${esc(t.partner_body)}</p>
</section>
<section class="section">
  <ul class="chips">
    <li>${esc(t.partner_pet)}</li>
    <li>${esc(t.partner_dist)}</li>
    <li>${esc(t.partner_wholesale)}</li>
  </ul>
  <p class="actions">
    <a class="btn btn-solid" href="${WHATSAPP}">${esc(site[lang].cta_whatsapp)}</a>
    <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(site[lang].cta_email)}</a>
  </p>
  <p class="note">${esc(t.no_store || "")}</p>
</section>
${contactBlock(lang)}`;
  return layout({
    lang,
    rel: "partners",
    active: "partners",
    title: `${t.nav_partners} — PURE PAW`,
    description: t.partner_body,
    body
  });
}

function contactPage(lang) {
  const c = site[lang];
  const t = UI[lang];
  const body = `
<section class="page-hero">
  <p class="eyebrow">PURE PAW / ${esc(t.nav_contact)}</p>
  <h1>${esc(c.contact_title)}</h1>
  <p class="lead">${esc(c.contact_body)}</p>
</section>
<section class="section split">
  <div>
    <p class="eyebrow">${esc(t.channels)}</p>
    <ul class="contact-list">
      <li><span>${esc(t.whatsapp)}</span><a href="${WHATSAPP}" dir="ltr">+998 99 987 68 88</a></li>
      <li><span>${esc(t.phone)}</span><a href="${PHONE_HREF}" dir="ltr">${PHONE}</a></li>
      <li><span>${esc(t.email)}</span><a href="mailto:${EMAIL}" dir="ltr">${EMAIL}</a></li>
    </ul>
  </div>
  <div>
    <p class="eyebrow">${esc(t.address)}</p>
    <address class="address-card">
      <strong>PURE PAW NUTRITION MCHJ</strong><br>
      Tashkent, Korasuv
    </address>
    <p class="note">${esc(t.no_store || "")}</p>
  </div>
</section>
${contactBlock(lang)}`;
  return layout({
    lang,
    rel: "contact",
    active: "contact",
    title: `${t.nav_contact} — PURE PAW`,
    description: c.contact_body,
    body
  });
}

async function writePage(rel, lang, html) {
  const dir = path.join(OUT, "a", lang, ...rel.split("/").filter(Boolean));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html, "utf-8");
}

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, "a", "assets"), { recursive: true });
await cp(path.join(__dirname, "styles/a.css"), path.join(OUT, "a", "assets", "styles.css"));
await cp(path.join(__dirname, "assets/logo.png"), path.join(OUT, "a", "assets", "logo.png"));

let pages = 0;
for (const lang of LANGS) {
  const t = UI[lang];
  const c = site[lang];
  await writePage("", lang, homePage(lang));
  await writePage("cat", lang, groupPage(lang, "cat"));
  await writePage("dog", lang, groupPage(lang, "dog"));
  await writePage("brand", lang, brandPage(lang));
  await writePage("partners", lang, partnersPage(lang));
  await writePage("contact", lang, contactPage(lang));
  for (const p of products) await writePage("product/" + p.slug, lang, productPage(lang, p));
  pages += 13;
}

const urls = [];
for (const lang of LANGS) {
  for (const rel of ["", "cat", "dog", "brand", "partners", "contact", ...products.map((p) => "product/" + p.slug)]) {
    urls.push(`${ORIGIN}${pagePath(lang, rel)}`);
  }
}
await writeFile(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
  "utf-8"
);
await writeFile(path.join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf-8");

console.log(`原型 A 构建完成：${pages} 个页面 -> ${OUT}`);
