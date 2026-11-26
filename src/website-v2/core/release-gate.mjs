const REQUIRED_LANGS = ["en", "zh", "ru", "ar", "uz", "kk", "ky", "tg"];
const CLAIM_PATTERNS = [
  /halal[\s-]?certified/i,
  /清真认证/,
  /сертифицирован[^.]{0,20}халял/i,
  /halol sertifikat/i,
  /sertifikatlangan halol/i,
  /حلال معتمد/,
  /vet[\s-]?approved/i,
  /兽医认证/,
  /third[\s-]?party (tested|lab)/i,
  /第三方检测/
];
const DRAFT_PATTERNS = [/prototype/i, /прототип/i, /prototip/i, /نموذج[^.]{0,20}أولي/, /原型/, /模拟/, /\bmock\b/i];

const scan = (value, patterns) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return patterns.some((re) => re.test(text));
};

export function checkRelease(content, { origin = "" } = {}) {
  const checks = [];
  const add = (id, label, pass, detail) => checks.push({ id, label, pass, detail });

  const enabled = content.LANG_LIST.filter((l) => l.enabled);
  const codes = enabled.map((l) => l.code);
  add(
    "langs-scope",
    "正式语言恰为八种，kaa/tr 关闭",
    codes.length === REQUIRED_LANGS.length && REQUIRED_LANGS.every((c) => codes.includes(c)) && !codes.includes("kaa") && !codes.includes("tr"),
    `启用：${codes.join("/")}`
  );

  const draftLangs = enabled.filter((l) => l.translation !== "official").map((l) => l.code);
  add("langs-translation", "八语翻译均达正式状态", draftLangs.length === 0, draftLangs.length ? `仍为草稿：${draftLangs.join("/")}` : "全部 official");

  const unapprovedLangs = enabled.filter((l) => !l.publicApproved).map((l) => l.code);
  add("langs-public", "启用语言均已批准公开", unapprovedLangs.length === 0, unapprovedLangs.length ? `未批准：${unapprovedLangs.join("/")}` : "全部已批准");

  const draftMeta = [
    ["ui.json", content.UI_META],
    ["forms.json", content.FORMS_META],
    ["marketing.json", content.MKT_META],
    ["d.json", content.D_META],
    ["products.json", content.PRODUCT_META],
    ["evidence.json", content.EVIDENCE_META]
  ].filter(([, m]) => !m || m.draft !== false).map(([name]) => name);
  add("content-draft", "内容文件均通过草稿审核", draftMeta.length === 0, draftMeta.length ? `仍标记草稿：${draftMeta.join("、")}` : "全部非草稿");

  add("products-approved", "产品数据整体获公开批准", content.PRODUCT_META.publicApproved === true, content.PRODUCT_META.publicApproved ? "已批准" : "publicApproved=false");

  const unverified = content.PRODUCTS.filter((p) => {
    const v = (content.PRODUCT_DATA[p.slug] || {}).verification || {};
    return v.status !== "verified" || v.approved !== true;
  }).map((p) => p.slug);
  add("products-verified", "7 个 SKU 数值已对照实物核验", unverified.length === 0, unverified.length ? `待核验：${unverified.join("、")}` : "全部已核验");

  const blockedFeeding = content.PRODUCTS.filter((p) => ((content.PRODUCT_DATA[p.slug] || {}).verification || {}).feedingBlocked).map((p) => p.slug);
  const pendingConflicts = (content.PRODUCT_META.conflicts || []).filter((c) => c.status !== "resolved").map((c) => `${c.slug}.${c.field}`);
  add("products-conflicts", "产品数据无未决冲突", blockedFeeding.length === 0 && pendingConflicts.length === 0, [...blockedFeeding, ...pendingConflicts].join("、") || "无");

  const logPending = content.CONTENT_LOG.filter((e) => e.approvalStatus !== "approved");
  add("content-log", "全部内容变更已获批准", logPending.length === 0, logPending.length ? `${logPending.length} 条待批准` : "全部 approved");

  const missingRequired = content.EVIDENCE.filter((i) => i.requiredForLaunch && i.status !== "verified");
  add(
    "evidence-required",
    "上线必需证据均已核实",
    missingRequired.length === 0,
    missingRequired.length ? missingRequired.map((i) => `${i.id}(${i.status})`).join("、") : "全部 verified"
  );

  const endpoint = content.FORMS_META.productionEndpoint || "";
  add(
    "forms-endpoint",
    "正式表单接收端已配置并获批",
    /^https:\/\//.test(endpoint) && content.FORMS_META.endpointApproved === true,
    endpoint ? endpoint : "未配置 productionEndpoint（当前只有本地模拟 API）"
  );

  const draftCopy = enabled
    .filter((l) => scan(content.UI[l.code].prototype, DRAFT_PATTERNS) || scan(content.FORMS[l.code], DRAFT_PATTERNS))
    .map((l) => l.code);
  add("draft-copy", "页面无原型/模拟提示文案", draftCopy.length === 0, draftCopy.length ? `仍含原型提示：${draftCopy.join("/")}` : "无");

  const claimsText = {
    site: content.SITE,
    ui: content.UI,
    forms: content.FORMS,
    marketing: content.MKT,
    d: content.D,
    errors: content.ERRORS
  };
  const claimHits = [];
  for (const [name, value] of Object.entries(claimsText)) {
    if (scan(value, CLAIM_PATTERNS)) claimHits.push(name);
  }
  add("claims-scan", "页面无未证实认证/检测宣称", claimHits.length === 0, claimHits.length ? `命中：${claimHits.join("、")}` : "未发现");

  add(
    "origin",
    "正式构建使用已批准的 HTTPS 域名",
    /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1|example\./.test(origin),
    origin || "未提供 --origin"
  );

  const blockers = checks.filter((c) => !c.pass).map((c) => `${c.label}：${c.detail}`);
  return { checks, blockers, pass: blockers.length === 0, checkedAt: new Date().toISOString() };
}
