import { PRODUCTS } from "./content.mjs";

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const escAttr = esc;
export const withLineBreaks = (s = "") => esc(s).split("\n").join("<br>");

export const PHONE = "+998 95 826 69 99";
export const PHONE_HREF = "tel:+998958266999";
export const EMAIL = "farid.it.uz@gmail.com";
export const WHATSAPP = "https://wa.me/998999876888";

export const sizesOf = (net) => {
  const m = String(net).match(/[:：]\s*(.+)$/);
  return m ? m[1] : net;
};

export const pagePath = (ctx, lang, rel = "") =>
  `${ctx.BASE}/${lang}/${rel ? rel.replace(/^\/+|\/+$/g, "") + "/" : ""}`;

export const pageUrl = (ctx, lang, rel = "") => `${ctx.ORIGIN}${pagePath(ctx, lang, rel)}`;

export function alternates(ctx, lang, rel) {
  const links = ctx.LANGS.map(
    (code) => `<link rel="alternate" hreflang="${code}" href="${escAttr(pageUrl(ctx, code, rel))}">`
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${escAttr(pageUrl(ctx, ctx.DEFAULT_LANG, rel))}">`);
  links.push(`<link rel="canonical" href="${escAttr(pageUrl(ctx, lang, rel))}">`);
  return links.join("\n");
}

export function langSwitch(ctx, lang, rel) {
  const items = ctx.LANGS.map((code) => {
    const active = code === lang ? ' aria-current="true" class="is-active"' : "";
    return `<a${active} href="${pagePath(ctx, code, rel)}" hreflang="${code}" lang="${code}" dir="${ctx.dirOf(code)}">${esc(ctx.nameOf(code))}</a>`;
  }).join("");
  return `<details class="lang-switch">
  <summary aria-label="${escAttr(ctx.UI[lang].lang)}"><span class="globe" aria-hidden="true">◎</span> ${esc(ctx.nameOf(lang))}</summary>
  <div class="lang-menu" role="group" aria-label="${escAttr(ctx.UI[lang].lang)}">${items}</div>
</details>`;
}

export function header(ctx, lang, rel, active) {
  const t = ctx.UI[lang];
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
      return `<a href="${pagePath(ctx, lang, href)}"${isActive}>${esc(t[key])}</a>`;
    })
    .join("");
  return `<header class="site-head">
  <a class="skip" href="#main">${esc(t.skip)}</a>
  <div class="head-inner">
    <a class="wordmark" href="${pagePath(ctx, lang)}" aria-label="PURE PAW">
      <img src="${ctx.BASE}/assets/logo.png" alt="PURE PAW" width="64" height="64">
      <span><strong>PURE PAW</strong><small>PET NUTRITION</small></span>
    </a>
    <nav class="main-nav" aria-label="PURE PAW">${nav}</nav>
    ${langSwitch(ctx, lang, rel)}
  </div>
</header>`;
}

export function footer(ctx, lang) {
  const t = ctx.UI[lang];
  return `<footer class="site-foot">
  <div class="foot-inner">
    <div>
      <p class="foot-brand">PURE PAW</p>
      <p>PURE PAW NUTRITION MCHJ<br>Tashkent, Korasuv</p>
    </div>
    <nav aria-label="PURE PAW">
      <a href="${pagePath(ctx, lang)}">${esc(t.nav_home)}</a>
      <a href="${pagePath(ctx, lang, "cat")}">${esc(t.nav_cat)}</a>
      <a href="${pagePath(ctx, lang, "dog")}">${esc(t.nav_dog)}</a>
      <a href="${pagePath(ctx, lang, "brand")}">${esc(t.nav_brand)}</a>
      <a href="${pagePath(ctx, lang, "partners")}">${esc(t.nav_partners)}</a>
      <a href="${pagePath(ctx, lang, "contact")}">${esc(t.nav_contact)}</a>
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

export function layout(ctx, { lang, rel, active, title, description, body, bodyClass = "" }) {
  const t = ctx.UI[lang];
  const url = pageUrl(ctx, lang, rel);
  const dir = ctx.dirOf(lang);
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(description)}">
${ctx.NOINDEX ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escAttr(url)}">
<meta property="og:site_name" content="PURE PAW">
<meta property="og:locale" content="${lang}">
<meta property="og:image" content="${escAttr(ctx.ORIGIN + ctx.BASE + "/assets/logo.png")}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${ctx.BASE}/assets/logo.png" type="image/png">
<link rel="stylesheet" href="${ctx.BASE}/assets/base.css">
<link rel="stylesheet" href="${ctx.BASE}/assets/theme.css">
${alternates(ctx, lang, rel)}
</head>
<body class="theme-${ctx.THEME} ${bodyClass}" data-prototype="${ctx.THEME}" data-lang="${lang}">
${header(ctx, lang, rel, active)}
<main id="main">
${body}
</main>
${footer(ctx, lang)}
<script src="${ctx.BASE}/assets/form.js" defer></script>
</body>
</html>`;
}

export const contactBlock = (ctx, lang) => {
  const t = ctx.UI[lang];
  const c = ctx.SITE[lang];
  return `<section class="contact-band">
  <div>
    <p class="eyebrow">PURE PAW</p>
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

export const netText = (net) => {
  const i = net.indexOf(": ");
  return i < 0 ? esc(net) : `${esc(net.slice(0, i + 2))}<bdi dir="ltr">${esc(net.slice(i + 2))}</bdi>`;
};

export const productCard = (ctx, lang, p) => {
  const c = ctx.SITE[lang];
  const prod = c.products[p.idx];
  return `<article class="card">
  <span class="num">${String(p.idx + 1).padStart(2, "0")}</span>
  <h3><a href="${pagePath(ctx, lang, "product/" + p.slug)}">${esc(prod.name)}</a></h3>
  <p class="meta">${netText(prod.net)}</p>
  <details>
    <summary>${esc(prod.ingredients_label)}</summary>
    <p><strong>${esc(prod.ingredients_heading)}</strong><br>${esc(prod.ingredients)}</p>
  </details>
  <p class="card-link"><a href="${pagePath(ctx, lang, "product/" + p.slug)}">${esc(ctx.UI[lang].view_product)} →</a></p>
</article>`;
};

export const noteBlock = (ctx, lang) => `<p class="note">${esc(ctx.SITE[lang].note)}</p>`;

export const orgJsonLd = (ctx, lang) => {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PURE PAW NUTRITION MCHJ",
    url: ctx.ORIGIN + pagePath(ctx, lang),
    logo: ctx.ORIGIN + ctx.BASE + "/assets/logo.png",
    address: { "@type": "PostalAddress", addressLocality: "Tashkent", addressRegion: "Korasuv", addressCountry: "UZ" },
    contactPoint: [{ "@type": "ContactPoint", telephone: "+998958266999", contactType: "customer service", availableLanguage: ctx.LANGS }]
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
};

export { PRODUCTS };
