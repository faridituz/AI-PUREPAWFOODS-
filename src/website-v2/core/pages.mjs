import {
  esc,
  withLineBreaks,
  pagePath,
  layout,
  contactBlock,
  productCard,
  noteBlock,
  sizesOf,
  orgJsonLd,
  PHONE,
  PHONE_HREF,
  EMAIL,
  WHATSAPP
} from "./html.mjs";
import { leadSection, leadForm } from "./forms.mjs";
import { PRODUCTS } from "./content.mjs";

const philosophyLabel = { en: "Our philosophy", ru: "Философия", uz: "Falsafamiz", zh: "品牌理念", ar: "فلسفتنا", kk: "Біздің философия", ky: "Биздин философия", tg: "Фалсафаи мо" };

export const PAGE_RELS = ["", "cat", "dog", "brand", "partners", "contact", ...PRODUCTS.map((p) => "product/" + p.slug)];

function heroBand(ctx, lang, { primary, secondary, seal = true }) {
  const c = ctx.SITE[lang];
  const t = ctx.UI[lang];
  return `<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">PURE PAW / PET NUTRITION</p>
    <h1>${withLineBreaks(c.hero_title)}</h1>
    <p class="lead">${esc(c.hero_lead)}</p>
    <p class="actions">
      <a class="btn btn-solid" href="${primary.href}">${esc(primary.label)}</a>
      <a class="btn btn-text" href="${secondary.href}">${esc(secondary.label)} →</a>
    </p>
  </div>
  ${
    seal
      ? `<div class="hero-seal">
    <img src="${ctx.BASE}/assets/logo.png" alt="PURE PAW" width="380" height="380" fetchpriority="high">
  </div>`
      : ""
  }
</section>`;
}

function groupSection(ctx, lang) {
  const t = ctx.UI[lang];
  const catCount = ctx.PRODUCTS.filter((p) => p.group === "cat").length;
  const dogCount = ctx.PRODUCTS.filter((p) => p.group === "dog").length;
  return `<section class="section">
  <p class="eyebrow">02 / ${esc(t.home_products)}</p>
  <div class="group-grid">
    <a class="group-card" href="${pagePath(ctx, lang, "cat")}">
      <span class="count">0${catCount}</span>
      <h2>${esc(t.nav_cat)}</h2>
      <p>${esc(t.cat_intro)}</p>
      <span class="group-link">${esc(t.view_range)} →</span>
    </a>
    <a class="group-card" href="${pagePath(ctx, lang, "dog")}">
      <span class="count">0${dogCount}</span>
      <h2>${esc(t.nav_dog)}</h2>
      <p>${esc(t.dog_intro)}</p>
      <span class="group-link">${esc(t.view_range)} →</span>
    </a>
  </div>
</section>`;
}

function rangesSection(ctx, lang) {
  const c = ctx.SITE[lang];
  return `<section class="section" id="ranges">
  <p class="eyebrow">03 / ${esc(c.ranges_title)}</p>
  <h2>${esc(c.ranges_title)}</h2>
  <div class="cards">
    ${PRODUCTS.map((p) => productCard(ctx, lang, p)).join("\n")}
  </div>
  ${noteBlock(ctx, lang)}
</section>`;
}

function trustStrip(ctx, lang) {
  const m = ctx.MKT[lang];
  return `<section class="trust-strip" aria-label="PURE PAW">
  <ul>
    <li><span aria-hidden="true">✓</span>${esc(m.trust_1)}</li>
    <li><span aria-hidden="true">✓</span>${esc(m.trust_2)}</li>
    <li><span aria-hidden="true">✓</span>${esc(m.trust_3)}</li>
  </ul>
</section>`;
}

function stepsSection(ctx, lang) {
  const m = ctx.MKT[lang];
  return `<section class="section steps">
  <p class="eyebrow">${esc(m.how_title)}</p>
  <ol>
    <li><span class="step-num">01</span><p>${esc(m.how_1)}</p></li>
    <li><span class="step-num">02</span><p>${esc(m.how_2)}</p></li>
    <li><span class="step-num">03</span><p>${esc(m.how_3)}</p></li>
  </ol>
</section>`;
}

function dealerBenefits(ctx, lang) {
  const m = ctx.MKT[lang];
  return `<ul class="benefit-list">
    <li>${esc(m.dealer_1)}</li>
    <li>${esc(m.dealer_2)}</li>
    <li>${esc(m.dealer_3)}</li>
  </ul>`;
}

function homePage(ctx, lang) {
  const c = ctx.SITE[lang];
  const t = ctx.UI[lang];
  const m = ctx.MKT[lang];
  let body = "";

  if (ctx.THEME === "b") {
    body += heroBand(ctx, lang, {
      primary: { href: "#ask", label: m.inquiry_title },
      secondary: { href: pagePath(ctx, lang, "partners"), label: t.nav_partners }
    });
    body += trustStrip(ctx, lang);
    body += `<section class="section split">
      <div><p class="eyebrow">01 / ${esc(philosophyLabel[lang] || philosophyLabel.en)}</p><h2>${esc(c.philosophy_title)}</h2></div>
      <div><p>${esc(c.philosophy_body)}</p></div>
    </section>`;
    body += stepsSection(ctx, lang);
    body += groupSection(ctx, lang);
    body += rangesSection(ctx, lang);
    body += leadSection(ctx, lang, "inquiry", {
      id: "ask",
      eyebrow: "PURE PAW / " + t.nav_contact,
      title: m.inquiry_title,
      lead: m.inquiry_lead,
      rel: ""
    });
  } else if (ctx.THEME === "c") {
    body += heroBand(ctx, lang, {
      primary: { href: "#ranges", label: c.cta_ranges },
      secondary: { href: "#dealer", label: m.dealer_title }
    });
    body += trustStrip(ctx, lang);
    body += `<section class="section split">
      <div><p class="eyebrow">01 / ${esc(philosophyLabel[lang] || philosophyLabel.en)}</p><h2>${esc(c.philosophy_title)}</h2></div>
      <div><p>${esc(c.philosophy_body)}</p></div>
    </section>`;
    body += groupSection(ctx, lang);
    body += rangesSection(ctx, lang);
    body += `<section class="section dealer-band" id="dealer">
      <div class="dealer-copy">
        <p class="eyebrow">PURE PAW / B2B</p>
        <h2>${esc(m.dealer_title)}</h2>
        <p>${esc(m.dealer_lead)}</p>
        ${dealerBenefits(ctx, lang)}
        <p class="actions">
          <a class="btn btn-solid" href="${WHATSAPP}">${esc(c.cta_whatsapp)}</a>
          <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(c.cta_email)}</a>
        </p>
      </div>
      <div class="dealer-form">${leadForm(ctx, lang, "dealer", { uid: "home", rel: "" })}</div>
    </section>`;
  } else {
    body += heroBand(ctx, lang, {
      primary: { href: "#ranges", label: c.cta_ranges },
      secondary: { href: pagePath(ctx, lang, "partners"), label: t.nav_partners }
    });
    body += `<section class="section split">
      <div><p class="eyebrow">01 / ${esc(philosophyLabel[lang] || philosophyLabel.en)}</p><h2>${esc(c.philosophy_title)}</h2></div>
      <div><p>${esc(c.philosophy_body)}</p></div>
    </section>`;
    body += groupSection(ctx, lang);
    body += rangesSection(ctx, lang);
  }
  body += contactBlock(ctx, lang);

  return layout(ctx, {
    lang,
    rel: "",
    active: "home",
    title: "PURE PAW — " + c.hero_title.replace(/\n/g, " "),
    description: c.hero_lead,
    body: ctx.THEME === "a" ? body + orgJsonLd(ctx, lang) : body
  });
}

function groupPage(ctx, lang, group) {
  const t = ctx.UI[lang];
  const list = ctx.PRODUCTS.filter((p) => p.group === group);
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
    ${list.map((p) => productCard(ctx, lang, p)).join("\n")}
  </div>
  ${noteBlock(ctx, lang)}
</section>
${contactBlock(ctx, lang)}`;
  return layout(ctx, {
    lang,
    rel: group,
    active: group,
    title: `${heading} — PURE PAW`,
    description: intro,
    body
  });
}

function productPage(ctx, lang, p) {
  const prod = ctx.SITE[lang].products[p.idx];
  const t = ctx.UI[lang];
  const groupLabel = p.group === "cat" ? t.nav_cat : t.nav_dog;
  const siblings = ctx.PRODUCTS.filter((x) => x.group === p.group && x.slug !== p.slug);
  const body = `
<section class="product-hero">
  <p class="eyebrow"><a href="${pagePath(ctx, lang, p.group)}">${esc(groupLabel)}</a> / ${String(p.idx + 1).padStart(2, "0")}</p>
  <h1>${esc(prod.name)}</h1>
  <p class="lead">${esc(prod.net)}</p>
</section>
<section class="section product-body">
  <div class="spec-card">
    <p class="eyebrow">${esc(prod.ingredients_heading)}</p>
    <p>${esc(prod.ingredients)}</p>
    <p class="note">${esc(ctx.SITE[lang].note)}</p>
  </div>
  <aside class="spec-side">
    <p class="eyebrow">${esc(t.sizes)}</p>
    <p class="size-line">${esc(sizesOf(prod.net))}</p>
    <p class="actions">
      <a class="btn btn-solid" href="${WHATSAPP}">${esc(prod.ask)}</a>
      <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(ctx.SITE[lang].cta_email)}</a>
    </p>
    <p class="note"><a href="${pagePath(ctx, lang, "contact")}#ask">${esc(t.nav_contact)} →</a></p>
  </aside>
</section>
<section class="section">
  <p class="eyebrow">${esc(t.more_from)}</p>
  <div class="cards cards-small">
    ${siblings
      .map(
        (s) => `<article class="card">
      <h3><a href="${pagePath(ctx, lang, "product/" + s.slug)}">${esc(ctx.SITE[lang].products[s.idx].name)}</a></h3>
      <p class="meta">${esc(ctx.SITE[lang].products[s.idx].net)}</p>
      <p class="card-link"><a href="${pagePath(ctx, lang, "product/" + s.slug)}">${esc(t.view_product)} →</a></p>
    </article>`
      )
      .join("\n")}
  </div>
  <p><a class="btn btn-text" href="${pagePath(ctx, lang, p.group)}">← ${esc(t.back)}</a></p>
</section>
${contactBlock(ctx, lang)}`;
  return layout(ctx, {
    lang,
    rel: "product/" + p.slug,
    active: p.group,
    title: `${prod.name} — PURE PAW`,
    description: `${prod.name}. ${prod.net}. ${prod.ingredients}`,
    body
  });
}

function brandPage(ctx, lang) {
  const c = ctx.SITE[lang];
  const t = ctx.UI[lang];
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
    <a class="btn btn-solid" href="${pagePath(ctx, lang, "cat")}">${esc(t.nav_cat)} →</a>
    <a class="btn btn-ghost" href="${pagePath(ctx, lang, "dog")}">${esc(t.nav_dog)} →</a>
  </p>
</section>
${contactBlock(ctx, lang)}`;
  return layout(ctx, {
    lang,
    rel: "brand",
    active: "brand",
    title: `${t.nav_brand} — PURE PAW`,
    description: c.philosophy_body,
    body
  });
}

function partnersPage(ctx, lang) {
  const t = ctx.UI[lang];
  const m = ctx.MKT[lang];
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
  ${dealerBenefits(ctx, lang)}
  <p class="actions">
    <a class="btn btn-solid" href="${WHATSAPP}">${esc(ctx.SITE[lang].cta_whatsapp)}</a>
    <a class="btn btn-ghost" href="mailto:${EMAIL}">${esc(ctx.SITE[lang].cta_email)}</a>
  </p>
  <p class="note">${esc(t.no_store || "")}</p>
</section>
${leadSection(ctx, lang, "dealer", { id: "dealer", eyebrow: m.dealer_title, title: m.dealer_title, lead: m.dealer_lead, rel: "partners" })}`;
  return layout(ctx, {
    lang,
    rel: "partners",
    active: "partners",
    title: `${t.nav_partners} — PURE PAW`,
    description: t.partner_body,
    body
  });
}

function contactPage(ctx, lang) {
  const c = ctx.SITE[lang];
  const t = ctx.UI[lang];
  const m = ctx.MKT[lang];
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
${leadSection(ctx, lang, "inquiry", { id: "ask", eyebrow: m.inquiry_title, title: m.inquiry_title, lead: m.inquiry_lead, rel: "contact" })}`;
  return layout(ctx, {
    lang,
    rel: "contact",
    active: "contact",
    title: `${t.nav_contact} — PURE PAW`,
    description: c.contact_body,
    body
  });
}

export function buildPages(ctx) {
  const pages = [];
  for (const lang of ctx.LANGS) {
    pages.push({ rel: "", lang, html: homePage(ctx, lang) });
    pages.push({ rel: "cat", lang, html: groupPage(ctx, lang, "cat") });
    pages.push({ rel: "dog", lang, html: groupPage(ctx, lang, "dog") });
    pages.push({ rel: "brand", lang, html: brandPage(ctx, lang) });
    pages.push({ rel: "partners", lang, html: partnersPage(ctx, lang) });
    pages.push({ rel: "contact", lang, html: contactPage(ctx, lang) });
    for (const p of PRODUCTS) pages.push({ rel: "product/" + p.slug, lang, html: productPage(ctx, lang, p) });
  }
  return pages;
}
