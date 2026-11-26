// 客户端与服务端共用的表单校验（无外部依赖，可被 toString() 内嵌到浏览器脚本）
export function validateLead(data = {}) {
  const errors = [];
  const LIMITS = { name: 80, company: 120, phone: 32, email: 120, city: 80, volume: 80, message: 2000, product: 80, channel: 40 };
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const values = {};
  for (const key of Object.keys(LIMITS)) values[key] = str(data[key]);
  const tooLong = Object.keys(LIMITS).filter((k) => values[k].length > LIMITS[k]);
  if (tooLong.length) errors.push("too_long");
  if (!values.name) errors.push("required");

  const digits = values.phone.replace(/\D/g, "");
  if (!values.phone || !/^[+0-9()\-\s]+$/.test(values.phone) || digits.length < 7 || digits.length > 15) {
    errors.push("phone");
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.push("email");

  const kind = data.kind === "dealer" ? "dealer" : "inquiry";
  const CHANNELS = ["pet_shop", "wholesale", "distributor", "grooming", "other"];
  if (kind === "dealer") {
    if (!values.company) errors.push("required");
    if (!CHANNELS.includes(values.channel)) errors.push("required");
  }
  if (data.consent !== true) errors.push("consent");
  if (str(data.website)) errors.push("spam");

  return { ok: errors.length === 0, kind, errors: [...new Set(errors)], values, tooLong };
}
