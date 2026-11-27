import { mkdir, writeFile, rm, access, symlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadContent } from "./core/content.mjs";
import { checkRelease } from "./core/release-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RELEASE_DIR = path.join(ROOT, "output/release");
const OUT = path.join(ROOT, "output/evidence/qa-gate.json");
const ORIGIN = "https://new.purepawfoods.com";

const results = [];
const add = (id, label, pass, detail) => results.push({ id, label, pass, detail });
const clone = (v) => JSON.parse(JSON.stringify(v));

const base = await loadContent();

const g1 = checkRelease(base, { origin: ORIGIN });
add("baseline-block", "未批准状态下门禁必须阻断", g1.pass === false && g1.blockers.length === 9, `阻断 ${g1.blockers.length} 项`);

const g2 = checkRelease(base, { origin: "http://localhost:4173" });
const originCheck = g2.checks.find((c) => c.id === "origin");
add("bad-origin", "http 或本地域名不得通过 origin 检查", originCheck.pass === false, originCheck.detail);

const g2b = checkRelease(base, { origin: "" });
add("no-origin", "缺少 --origin 时不得通过", g2b.checks.find((c) => c.id === "origin").pass === false, "未提供 origin");

const c3 = clone(base);
c3.MKT.en.trust_1 = "Halal certified production";
const g3 = checkRelease(c3, { origin: ORIGIN });
add("claim-injection", "注入未证实认证宣称必须被拦截", g3.checks.find((c) => c.id === "claims-scan").pass === false, g3.checks.find((c) => c.id === "claims-scan").detail);

const c4 = clone(base);
c4.CONTENT_LOG[0].approvalStatus = "approved";
const g4 = checkRelease(c4, { origin: ORIGIN });
add("partial-approval", "仅批准单条内容不得放行", g4.checks.find((c) => c.id === "content-log").pass === false, g4.checks.find((c) => c.id === "content-log").detail);

const c5 = clone(base);
for (const l of c5.LANG_LIST) {
  if (l.enabled) {
    l.translation = "official";
    l.publicApproved = true;
  }
}
for (const m of [c5.UI_META, c5.FORMS_META, c5.MKT_META, c5.D_META, c5.PRODUCT_META, c5.EVIDENCE_META]) m.draft = false;
c5.PRODUCT_META.publicApproved = true;
c5.PRODUCT_META.conflicts.forEach((c) => (c.status = "resolved"));
for (const p of c5.PRODUCTS) {
  const d = c5.PRODUCT_DATA[p.slug];
  d.verification.status = "verified";
  d.verification.approved = true;
  d.verification.feedingBlocked = false;
}
for (const e of c5.CONTENT_LOG) e.approvalStatus = "approved";
c5.FORMS_META.productionEndpoint = "https://new.purepawfoods.com/api/lead";
c5.FORMS_META.endpointApproved = true;
for (const l of c5.LANG_LIST) {
  if (l.enabled) {
    c5.UI[l.code].prototype = "PURE PAW";
    if (c5.FORMS[l.code].meta && c5.FORMS[l.code].meta.prototype) delete c5.FORMS[l.code].meta.prototype;
  }
}
const g5 = checkRelease(c5, { origin: ORIGIN });
const onlyEvidence = g5.checks.filter((c) => c.id === "evidence-required").every((c) => c.pass === false);
add("evidence-hard-block", "即使伪造全部审批，缺失证据仍必须阻断", onlyEvidence && g5.pass === false, g5.blockers.join("；"));

const c6 = clone(base);
c6.EVIDENCE.find((e) => e.id === "halal-certificate").status = "verified";
c6.EVIDENCE.find((e) => e.id === "product-photos").status = "verified";
const g6 = checkRelease(c6, { origin: ORIGIN });
const ev6 = g6.checks.find((c) => c.id === "evidence-required");
add("partial-evidence", "仅补齐部分证据不得放行", ev6.pass === false, ev6.detail);

await mkdir(path.join(RELEASE_DIR, "d"), { recursive: true });
await writeFile(path.join(RELEASE_DIR, "d", "stale.html"), "stale build", "utf-8");
const run = spawnSync(process.execPath, ["build.mjs", "--release", "--origin", ORIGIN], { cwd: __dirname, encoding: "utf-8" });
let gone = true;
try {
  await access(RELEASE_DIR);
  gone = false;
} catch {
  gone = true;
}
add("stale-residue", "门禁失败时必须清理旧发布目录且退出码非 0", run.status === 1 && gone, `exit=${run.status} 残留=${gone ? "无" : "存在"}`);

const build = (...extra) => spawnSync(process.execPath, ["build.mjs", ...extra], { cwd: __dirname, encoding: "utf-8" });
const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const SENTINEL = path.join(ROOT, "data/temp/guard-sentinel.txt");
await mkdir(path.dirname(SENTINEL), { recursive: true });
await writeFile(SENTINEL, "sentinel", "utf-8");
const runRoot = build("--index", "--out", "../../..");
add("guard-root", "拒绝把输出目录指向项目根目录或上级", runRoot.status !== 0 && (await exists(SENTINEL)) && (await exists(path.join(ROOT, "AGENTS.md"))), `exit=${runRoot.status}`);

const runData = build("--index", "--out", "../../data");
add("guard-data", "拒绝把输出目录指向 output 之外的 data/", runData.status !== 0 && (await exists(path.join(ROOT, "data/extracted/barcodes.txt"))), `exit=${runData.status}`);

const runOutput = build("--index", "--out", "../../output");
add("guard-output", "拒绝删除 output/ 本身", runOutput.status !== 0 && (await exists(path.join(ROOT, "output/evidence"))), `exit=${runOutput.status}`);

const LINK = path.join(ROOT, "output/.gate-link");
await rmdir(LINK).catch(() => {});
await symlink(path.join(ROOT, "data"), LINK, "junction");
const runLink = build("--index", "--out", "../../output/.gate-link");
const linkKept = await exists(LINK);
const dataKept = await exists(path.join(ROOT, "data/extracted/barcodes.txt"));
add("guard-junction", "拒绝通过目录联接删除项目外内容", runLink.status !== 0 && linkKept && dataKept, `exit=${runLink.status} 联接=${linkKept ? "保留" : "已删"} 数据=${dataKept ? "完好" : "丢失"}`);
await rmdir(LINK).catch(() => {});
await rm(SENTINEL, { force: true });

const TEMP_OUT = "../../output/.gate-test-nonrelease";
const run2 = spawnSync(process.execPath, ["build.mjs", "--index", "--out", TEMP_OUT], { cwd: __dirname, encoding: "utf-8" });
add("no-release-via-flags", "非 release 构建不得写入 output/release", run2.status === 0 && gone, `exit=${run2.status}`);
await rm(path.resolve(__dirname, TEMP_OUT), { recursive: true, force: true });

const failed = results.filter((r) => !r.pass);
const report = {
  checkedAt: new Date().toISOString(),
  checks: results.length,
  failed: failed.length,
  results
};
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), "utf-8");
console.log(`门禁补充测试：${results.length} 项，失败 ${failed.length} 项`);
for (const r of results) console.log(`${r.pass ? "通过" : "失败"}  ${r.label} —— ${r.detail}`);
console.log(`报告 -> ${path.relative(ROOT, OUT)}`);
process.exit(failed.length ? 1 : 0);
