# CODEX 独立审核入口（V2.7）

本文件用于 Codex 集中审核，不需要阅读历史聊天。所有结论以仓库当前文件与命令输出为准；Qoder 自查不等于独立验收。

## 1. 当前提交

- 分支：`main`
- V2.7 变更提交：见 `git log --oneline -3`（本文件随该提交入库；V2.6 基线为 `87e68c0`）
- 远端：`https://github.com/faridituz/AI-PUREPAWFOODS-.git`

## 2. 启动方式

```bash
node --version                 # 需要 Node >= 22；本机验证 26.13.1
cd src/website-v2
node build.mjs                 # 生成 A/B/C/D × 8 语 × 13 页 = 416 页
node serve.mjs ../../output/prototypes 4173   # 本地预览（mock 表单 API）
```

无 npm 依赖、无 `package.json`、无 LFS。Python 3.12 仅用于 `src/check_env.py`（需 `.env`，不入库）。

## 3. 正式候选

- **D 主题**为唯一正式候选（`/d/{lang}/`）；A/B/C 仅内部档案。
- 正式构建：`node build.mjs --release --origin https://<正式域名>`
- 当前门禁：13 项，4 通过 / 9 阻断；失败时退出码 1 且清理 `output/release`，不生成任何发布文件。

## 4. 核心架构

- 零依赖 Node ESM 静态生成器：`src/website-v2/build.mjs`
- 内容源：`src/website-v2/content/*.json`（site/ui/forms/marketing/errors/products/d/evidence/content-log/languages/barcodes/risks）
- 组件：`core/content.mjs`（加载校验）、`core/pages.mjs`（13 类页面）、`core/html.mjs`（SEO/RTL/hreflang）、`core/release-gate.mjs`（13 项门禁）
- 本地服务：`serve.mjs`（静态 + mock 线索 API + 安全头 + 限流 + 多语言 404）

## 5. 八语言架构

- en/zh/ru/ar/uz/kk/ky/tg，8 语独立 URL，hreflang 8 条 + x-default；kaa/tr 关闭。
- 原站为单 URL 面板切换（已截图：`output/evidence/live-langs/`）；新站为独立路由。
- en/ru/uz 的 `translation=official` 仅表示沿用原站已发布原文；项目内**没有人工审校签署记录**，全部 `reviewStatus=no-review-record`。

## 6. 产品主数据风险

`src/website-v2/content/product-risks.json`：

- P1-001 条码 4780178200193 冲突（全犬鸡肉 1.5 / 小犬牛肉 1.5）
- P1-002 小犬鸡肉俄语磷 ≥0.91% vs ≥0.9%
- P1-003 小犬牛肉 100–125g 无原始证据（源文件 `100--125g`）
- P1-004 多组鸡/牛共用喂食表
- P1-005 幼猫注册名含“孕哺猫”
- P1-006 7 SKU 未实物/原始包装核验

## 7. 条码冲突

- GS1 登记 PDF 实为 **24 条 GTIN**（旧记录误写 16，已修正）。
- 24 条校验位全部正确、登记内无重复；19 条映射到 SKU 规格，5 条未映射（20131/20148/20155/20216/20223）。
- 校验位正确 ≠ 合法分配或对应关系正确；全部未批准。
- 明细：`output/V2.7_条码核对表_20261127.md`、`output/evidence/barcodes.json`、Excel「条码核对」。

## 8. 营养/喂食冲突

- 小犬牛肉 6–8kg 低活动量四语 `100--125g`（鸡肉为 `100-125g`），喂食表已 `feedingBlocked`。
- 小犬鸡肉 3kg 俄语磷 ≥0.91%，其余 ≥0.9%。
- 幼猫 1.5kg 俄语表头截断 `г/де`。
- 反向核验：295 项，5 处源侧问题（`output/evidence/source-check.json`）。

## 9. 内容发布门禁

- 13 项：语言范围/翻译状态/公开批准/草稿/产品批准/实物核验/数据冲突/内容日志/必需证据/表单端点/草案文案/认证宣称/HTTPS origin。
- content-log 9 条全部 pending；evidence 22 项五状态；`requiredForLaunch` 8 项未满足。
- 补充测试 `qa-gate.mjs`：9 场景（伪造审批仍被证据阻断、注入宣称、错误 origin、旧发布残留清理等）。

## 10. 表单安全

- 前端：长度/电话/邮箱/渠道/同意/蜜罐 + 8s 超时 + 幂等 ID + 重试。
- 服务端 mock：同源 JSON、16KB 限制、5 次/分钟限流、蜜罐、幂等、脱敏日志、CSP。
- 正式接收端未配置；方案 A（GoDaddy 邮箱表单）/B（授权 CRM）/C（WhatsApp/Telegram 临时）比较见 `output/V2.7_咨询接收端与SEO迁移_20261127.md`。

## 11. SEO 迁移

- 原站实测：仅 `/`、`/sample-page/`、`/hello-world/`、`/category/uncategorized/`；无产品 URL、无 hreflang、单 URL 面板切换。
- 301/410 映射、canonical 自引用、hreflang、sitemap、404 方案见同上文档；无 GSC/Bing 权限，历史收录无法确认。

## 12. 主机兼容性

- 产物为纯静态 HTML/CSS/JS；GoDaddy Linux/Apache 可直接托管。
- 需配置 301/410、404、HTTPS；若采用表单方案 A，需 PHP + 企业邮箱 SMTP。
- 未在 GoDaddy 实测，不得声称已兼容验证。

## 13. 数据保护

- `.env`、`.local/`、`media/`（除已追踪文件）、`data/` 默认不入库；无密钥入库（已扫描）。
- 克隆后需单独安全迁移 `.env`（DATABASE_URL / MEDIA_STORAGE_PATH / TG_*）；不要在聊天/代码中传输。
- 表单不收集真实客户数据；mock 提交不进入任何 CRM。

## 14. 部署与回滚

- 部署仅在所有者批准后执行；禁止未批准修改 DNS/WordPress/生产配置。
- 回滚：保留旧 WordPress 文件与数据库备份；新站为静态目录，可整目录回退。
- `output/release` 当前不存在；门禁失败会清理旧产物，避免误部署过期构建。

## 15. 已有测试命令

```bash
cd src/website-v2
node qa-gate.mjs                                  # 9 项门禁场景
node audit-barcodes.mjs                           # 24 条 GTIN 核对
node check-sources.mjs                            # 295 项反向核验（5 处源侧问题）
node qa-layout.mjs http://localhost:4173          # 736 组合
node qa-data.mjs --base http://localhost:4173     # 1925 项
node qa-multilingual.mjs --base http://localhost:4173  # 2468 项（origin 必须与 --base 同端口）
node qa-forms.mjs                                 # 53 项
node build.mjs --release --origin https://new.purepawfoods.com  # 必须失败
node qa-release.mjs output/prototypes/d           # 原型泄漏检查
```

## 16. 尚未验证

- 真实设备/浏览器矩阵（仅无头 Chrome CDP）。
- GoDaddy 实际主机、PHP 邮件、301/404 配置。
- 7 SKU 实物包装、营养标签、条码印刷对应。
- 8 语母语审校。
- 搜索引擎历史收录与 301 效果。
- 另一台真实电脑（本机干净目录克隆已验证，但不等同真实第二台机验收）。

## 17. 必须独立复核的风险

1. 条码 0193/0162 的实际印刷对应与 5 个未映射 GTIN。
2. 小犬牛肉喂食量与共用喂食表。
3. 门禁是否可被参数/环境变量绕过（已检查 build 无 env 分支；请复核）。
4. `output/release` 清理逻辑是否可能误删非生成目录。
5. 正式表单方案的隐私合规与线索不丢失。
6. 原站 301 映射是否破坏历史链接。
7. 多语言 `official` 状态是否会被误解为已审校（已在语言清单与八语审核表标注 `no-review-record`）。
