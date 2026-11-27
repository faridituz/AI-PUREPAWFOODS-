import { esc, escAttr, pagePath, WHATSAPP, mailLink } from "./html.mjs";

export function channelPanel(ctx, lang) {
  const C = (ctx.FORMS[lang] || {}).closed || {};
  const ch = ctx.FORMS_META.channels || {};
  const items = [];
  if (ch.whatsapp && ch.whatsapp.approved === true && ch.whatsapp.href) {
    items.push(`<a class="btn btn-solid" href="${escAttr(ch.whatsapp.href)}" rel="noopener">${esc(C.whatsapp || "WhatsApp")}</a>`);
  }
  if (ch.phone && ch.phone.approved === true && ch.phone.href) {
    items.push(`<a class="btn btn-ghost" href="${escAttr(ch.phone.href)}" dir="ltr">${esc(C.call || "")}</a>`);
  }
  if (ch.telegram && ch.telegram.approved === true && /^https:\/\/t\.me\//.test(ch.telegram.href || "")) {
    items.push(`<a class="btn btn-ghost" href="${escAttr(ch.telegram.href)}" rel="noopener">Telegram</a>`);
  }
  if (ch.email && ch.email.approved === true && /^mailto:/.test(ch.email.href || "")) {
    items.push(`<a class="btn btn-ghost" href="${escAttr(ch.email.href)}">${esc(C.email || "Email")}</a>`);
  }
  return `<div class="contact-channels">
  <p class="actions">${items.join("\n")}</p>
  <p class="note">${esc(C.note || "")}</p>
</div>`;
}

export function leadForm(ctx, lang, kind, opts = {}) {
  if (ctx.FORMS_META.mode !== "online") return channelPanel(ctx, lang);
  const F = ctx.FORMS[lang];
  const t = ctx.UI[lang];
  const copy = F[kind];
  const uid = opts.uid || "main";
  const id = `${kind}-${lang}-${uid}`;
  const field = (name, label, control, cls = "") =>
    `<div class="field ${cls}">
      <label for="${id}-${name}">${esc(label)}</label>
      ${control}
    </div>`;

  const input = (name, type, extra = "") =>
    `<input id="${id}-${name}" name="${name}" type="${type}" ${extra} aria-required="${["name", "phone"].includes(name) ? "true" : "false"}">`;

  const productOptions = ctx.PRODUCTS.map(
    (p) => `<option value="${p.slug}">${esc(ctx.SITE[lang].products[p.idx].name)}</option>`
  ).join("");

  const channelOptions = Object.entries(F.channel)
    .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`)
    .join("");

  const fields =
    kind === "dealer"
      ? [
          field("company", F.fields.company, input("company", "text", `maxlength="120" autocomplete="organization" placeholder="${escAttr(F.ph.company)}" required`)),
          field("name", F.fields.name, input("name", "text", `maxlength="80" autocomplete="name" placeholder="${escAttr(F.ph.name)}" required`)),
          field("phone", F.fields.phone, input("phone", "tel", `maxlength="32" autocomplete="tel" inputmode="tel" placeholder="${escAttr(F.ph.phone)}" required`)),
          field("email", F.fields.email, input("email", "email", `maxlength="120" autocomplete="email" placeholder="${escAttr(F.ph.email)}"`)),
          field("city", F.fields.city, input("city", "text", `maxlength="80" autocomplete="address-level2" placeholder="${escAttr(F.ph.city)}"`)),
          field(
            "channel",
            F.fields.channel,
            `<select id="${id}-channel" name="channel" required>${channelOptions}</select>`,
            "field-half"
          ),
          field("volume", F.fields.volume, input("volume", "text", `maxlength="80" placeholder="${escAttr(F.ph.volume)}"`), "field-half"),
          field(
            "message",
            F.fields.message,
            `<textarea id="${id}-message" name="message" rows="4" maxlength="2000" placeholder="${escAttr(F.ph.message)}"></textarea>`,
            "field-full"
          )
        ]
      : [
          field("name", F.fields.name, input("name", "text", `maxlength="80" autocomplete="name" placeholder="${escAttr(F.ph.name)}" required`)),
          field("phone", F.fields.phone, input("phone", "tel", `maxlength="32" autocomplete="tel" inputmode="tel" placeholder="${escAttr(F.ph.phone)}" required`)),
          field("email", F.fields.email, input("email", "email", `maxlength="120" autocomplete="email" placeholder="${escAttr(F.ph.email)}"`)),
          field("city", F.fields.city, input("city", "text", `maxlength="80" autocomplete="address-level2" placeholder="${escAttr(F.ph.city)}"`)),
          field(
            "product",
            F.fields.product,
            `<select id="${id}-product" name="product"><option value="">—</option>${productOptions}</select>`,
            "field-full"
          ),
          field(
            "message",
            F.fields.message,
            `<textarea id="${id}-message" name="message" rows="4" maxlength="2000" placeholder="${escAttr(F.ph.message)}"></textarea>`,
            "field-full"
          )
        ];

  return `<form class="lead-form" id="${id}" data-lead-form data-kind="${kind}"
  data-msg-required="${escAttr(F.errors.required)}"
  data-msg-phone="${escAttr(F.errors.phone)}"
  data-msg-email="${escAttr(F.errors.email)}"
  data-msg-too-long="${escAttr(F.errors.too_long)}"
  data-msg-rate="${escAttr(F.errors.rate)}"
  data-msg-network="${escAttr(F.errors.network)}"
  data-msg-server="${escAttr(F.errors.server)}"
  data-msg-consent="${escAttr(F.errors.consent)}"
  data-msg-sending="${escAttr(F.status.sending)}"
  data-msg-success-extra="${escAttr(F.status.success_extra)}"
  data-msg-received="${escAttr(F.status.received)}"
  data-msg-retry="${escAttr(F.status.error_retry)}"
  data-success="${escAttr(copy.success)}"
  novalidate>
  <input type="hidden" name="kind" value="${kind}">
  <input type="hidden" name="lang" value="${lang}">
  <input type="hidden" name="page" value="${escAttr(pagePath(ctx, lang, opts.rel || ""))}">
  <input type="hidden" name="source" value="${escAttr("prototype-" + ctx.THEME)}">
  <input type="hidden" name="utm" value="">
  <div class="form-fields">${fields.join("\n")}</div>
  <div class="hp" aria-hidden="true">
    <label for="${id}-website">Website</label>
    <input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off">
  </div>
  <label class="consent">
    <input type="checkbox" name="consent" required>
    <span>${esc(F.fields.consent)}</span>
  </label>
  <p class="privacy-note"><strong>${esc(F.privacy.title)}</strong> ${esc(F.privacy.body)}</p>
  <div class="form-actions">
    <button class="btn btn-solid" type="submit">${esc(copy.submit)}</button>
    <a class="btn btn-text" href="${WHATSAPP}">WhatsApp</a>
    ${mailLink(esc(t.email), "btn btn-text")}
  </div>
  <div class="form-status" role="status" aria-live="polite" hidden></div>
  <p class="form-mock">${esc(copy.mock_note || F.inquiry.mock_note)}</p>
</form>`;
}

export function leadSection(ctx, lang, kind, { id, eyebrow, title, lead, rel }) {
  return `<section class="section form-section" id="${id}">
  <div class="form-grid">
    <div class="form-copy">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(title)}</h2>
      <p>${esc(lead)}</p>
    </div>
    ${leadForm(ctx, lang, kind, { rel })}
  </div>
</section>`;
}
