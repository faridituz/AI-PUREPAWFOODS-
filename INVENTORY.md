# 现有功能与脚本资产清单（禁止重复造轮子）

| 模块名称 | 文件路径 | 核心功能说明 | 输入/输出 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 四原型统一构建器 | `src/website-v2/build.mjs` | 单一内容源生成 A/B/C/D 四主题×8语×13类=416页；含 hreflang/canonical/RTL/sitemap/robots/assets/content-status；`--index` 切生产索引；`--release` 只构建 D、强制索引、先跑发布门禁 | `content/*.json`、`core/*`、`styles/*` -> `output/prototypes/{a,b,c,d}/` 或 `output/release/` | 已实测：416页；release 门禁 13项拦截9项 |
| 正式发布门禁 | `src/website-v2/core/release-gate.mjs` | 13项上线检查：八语范围/翻译状态/草稿标记/产品批准/实物核验/数据冲突/内容日志/必需证据/表单接收端/原型文案/认证宣称/HTTPS origin | content ctx + origin -> 通过/阻断清单 | 已实测：4通过9阻断，未生成发布文件 |
| 内容加载与校验 | `src/website-v2/core/content.mjs` | 读取 languages/site/ui/forms/marketing/errors/products/d/evidence/content-log；校验语言齐全、产品数、9项营养、喂食表、证据五状态+requiredForLaunch/publicUse、内容日志九字段 | JSON -> 统一 ctx | 已实测 |
| 真实产品数据源 | `src/website-v2/content/products.json` | 7 SKU 保证分析值/喂食表/动物性原料占比/规格/来源/冲突/逐SKU核验状态，唯一数字源 | 包装 docx -> JSON | 已实测；`draft:true, publicApproved:false`，7 SKU `pending-physical` |
| 素材证据登记 | `src/website-v2/content/evidence.json` | 22 项素材按已验证/未授权/冲突/缺失/待复核五类登记；含文件、版本、日期、持有人/签发机构、公开范围、是否阻断上线 | 素材路径 -> 状态清单 | 已实测 |
| 内容变更日志 | `src/website-v2/content/content-log.json` | v2.6 九字段：来源/产品版本/证据状态/审核状态/批准状态/适用语言；未批准禁止进入正式构建 | 变更 -> 记录 | 已实测：8条 pending |
| D 方案专属文案 | `src/website-v2/content/d.json` | D 首页“每袋都公开什么”8 语言文案 | JSON | 已实测 |
| HTML/SEO 组件 | `src/website-v2/core/html.mjs` | 转义、页面路径、9条 hreflang、canonical、语言切换、header/footer、JSON-LD | ctx -> HTML | 已实测 |
| 表单校验（共享） | `src/website-v2/core/validate.mjs` | 前后端共用 `validateLead`：长度、电话、邮箱、渠道、同意、蜜罐 | 表单对象 -> `{ok,errors,values}` | 已实测（44项） |
| 表单与页面模板 | `src/website-v2/core/forms.mjs`、`pages.mjs` | 询价/经销商表单区块；13类页面与三主题首页旅程 | ctx+lang -> HTML | 已实测 |
| 前端表单脚本 | `src/website-v2/assets/form.js` | 提交、错误提示、8s超时、幂等ID、重试、状态播报；构建时注入 validateLead | 浏览器事件 -> `/api/lead` | 已实测 |
| 四主题样式 | `src/website-v2/styles/base.css`、`theme-{a,b,c,d}.css` | 共享版式+表单/信任条/步骤/招商带+营养/喂食表；D 为森林绿+金铜细节统一版 | CSS | 已实测 736 组合 |
| 表单安全测试 | `src/website-v2/qa-forms.mjs` | 服务端（限流/蜜罐/幂等/XSS/415/413）+ 浏览器端 a/b/c/d×en/ru/ar，共53项；自起 4174(API)/4175(UI，STRESS) 独立服务 | 构建产物 -> `output/evidence/qa-forms.json` | 已实测 53/0 |
| 多语言与封闭功能检查 | `src/website-v2/qa-multilingual.mjs` | 2,468项：翻译键/规格/SEO/RTL/404/封闭功能；含 d.json；`--prod` 校验生产索引 | 本地服务 -> 控制台/JSON | 已实测 2468/0 |
| 产品数据一致性检查 | `src/website-v2/qa-data.mjs` | 4主题×8语×7 SKU 逐页比对营养/喂食/规格/占比；扫描虚标与喂食笔误；校验语言治理 | 本地服务 -> `output/evidence/qa-data.json` | 已实测 1925/0 |
| 本机隔离压测 | `src/website-v2/stress.mjs` | 10/50/100并发、单/6/8语言、D首页、长跑、冷启动、缓存失效；独立端口 4180/4181 | 构建产物 -> `output/evidence/stress-report.json` | 已实测 13 场景 0 失败 |
| 截图工具 | `src/website-v2/shot.mjs` | CDP 指定 URL/宽高截图 | url,w,h,out -> PNG | 已实测 |
| 正式站八语证据 | `src/website-v2/evidence-langs.mjs` | 只读打开正式站，逐语点击语言选择器并截取 8 个面板，记录标题/可见性/URL | 正式站 -> `output/evidence/live-langs/{8语}.png` + manifest | 已实测 8/8 |
| 真实资料盘点 | `src/website-v2/materials.mjs` | 扫描 `media/`，记录路径/SHA-256/docx元数据/SKU/规格/证据状态/公开范围 | media -> `output/evidence/materials.json` | 已实测 31 文件 |
| 数据反向核验 | `src/website-v2/check-sources.mjs` | 用 19 份包装数据稿反向核验 products.json：四语喂食表/9项营养/每日量/单位/跨规格/跨产品 | 提取稿+products.json -> `output/evidence/source-check.json` | 已实测 295项，5处源文件问题 |
| 发布包泄漏检查 | `src/website-v2/qa-release.mjs` | 构建后扫描：noindex/原型标记/mock/localhost/测试数据/A-B-C链接/页面数/404/sitemap/robots | 构建目录 -> `output/evidence/qa-release.json` | 已实测：原型D识别7项泄漏 |
| 8语原型生成器（方案A，旧） | `src/website-v2/build-a.mjs` | 初版单主题生成器 | 旧 content/styles -> `output/prototypes/a/` | 已被 `build.mjs` 取代，保留备查 |
| 原型本地预览与模拟API | `src/website-v2/serve.mjs` | 静态服务 + mock 线索 API（同源/JSON/16KB/限流/蜜罐/幂等/脱敏日志）、CSP等安全头、ETag/304、多语言404；`STRESS=1` 开放统计 | 原型目录 -> http://localhost:4173 | 已实测 |
| 8语布局自检 | `src/website-v2/qa-layout.mjs` | CDP 驱动 Chrome，四主题×8语×7断点×5页（含320/360/412/1920）检查溢出/lang/dir/hreflang/noindex/中文串入/表单；含切换保页与后退交互 | 本地服务 -> 控制台/`output/evidence/qa-layout.json` | 已实测：736组合0异常 |
| 性能对比测试 | `src/website-v2/perf.mjs` | CDP 模拟 390px+3G，采集 FCP/LCP/CLS/传输量，对比原型与线上 | URL 列表 -> `output/evidence/perf.json` | 已实测：原型LCP 600–840ms，线上996ms |
| 8语内容源 | `src/website-v2/content/languages.json`、`site.json`、`ui.json`、`forms.json`、`marketing.json`、`errors.json`、`products.json`、`d.json`、`evidence.json`、`content-log.json` | 语言开关 + 8语真实文案/表单/营销/404 词条 + 产品数值 + 素材登记 + 变更日志 | JSON | 8语×7产品完整；新增语言标原型草稿 |
| 三通环境自检 | `src/check_env.py` | 读取 `.env`，校验 Neon 数据库连接、媒体盘读写、Telegram 测试推送（含 3 次指数退避重试） | `.env` -> PASS/FAIL 输出，全部通过退出码 0 | 本机 3/3 实测通过（Python 3.12） |
| 网站八语更新页生成 | `src/website/prepare_website_update_20261110.py` | 读取上线前备份 HTML 与 Word 源 JSON，生成八语更新版 HTML 及更新说明 md | `output/PurePaw_上线前备份_20261110.html`、`output/website_word_sources_20261110.json` -> `output/PurePaw_网站更新_20261110.html` 等 | 已实测通过（Python 3.12.10，8 语言/19 规格断言全过）；说明 md 已加防覆盖守卫，仅首次生成 |
| SKU docx 批量生成 | `src/tools/gen-sku-docx.mjs` | 按 sku-data 数据批量生成各 SKU 定制 Word 文档 | `data/work/sku-data` -> `data/work/build` | 已通过 `node --check`，未实测 |
| 包装 docx 文本提取 | `src/tools/extract-docx-text.py` | 纯标准库解包 docx，提取段落/表格为 txt，供产品数据录入 | `media/包装资料` -> `data/extracted/packaging` | 已实测：19 份全部提取 |
| Word XML 校验 | `src/tools/xmlcheck.ps1` | 批量检查解包 docx 的 XML 完整性并输出缺失清单 | `data/work/xmllist.txt` | 已通过语法解析 |
| docx 重新打包 | `src/tools/zip-docx.ps1` | 将 build 目录重新打包为 docx | `data/work/build` -> `outputs/packaging-word` | 已通过语法解析 |
| docx 结构校验 | `src/tools/verify-docx.mjs` | 读取 docx 二进制条目做结构校验 | docx 文件 | 已通过 `node --check` |
| P0-B 浏览器验收 | `src/tools/purepaw-p0b-browser.mjs` | P0-B 阶段浏览器自动化验收 | 验收产物 | 历史验收脚本 |
| QA 浏览器验收 | `src/qa-runtime/browser-acceptance.mjs` | QA 运行时浏览器验收（含证据目录） | `src/qa-runtime/evidence` | 历史验收脚本 |
| 狗粮包装审阅 | `outputs/dog-review/read.py`、`report.py`、`review19.py`、`latest_review.py` | 解析狗粮 Word 源文件并生成审阅报告 | 依赖旧机桌面路径 `C:/Users/yinho/Desktop/包装袋/狗` | 历史脚本，本机不可直接运行 |
| 包装资料审核 | `outputs/packaging-audit/extract.py`、`compare.py`、`report.py`、`create_missing.py` | 包装资料抽取、比对差异、补齐缺失 Word | 依赖旧机桌面路径 `C:/Users/yinho/Desktop/包装袋` | 历史脚本，本机不可直接运行 |
| PSD 批量分析 | `outputs/01a19155/grouped.py`、`reference-layout.py` | PSD/参考版式分析与分组 | 历史输入文件 | 历史脚本 |
| 销售系统离线 OSM 候选导入 | `sales-v1-dev/server/field-discovery.mjs`、`sales-v1-dev/server/postgres-preview-bank.mjs` | 复用坐标、许可与来源验证，PostgreSQL 候选池按来源去重 | 离线 JSON → 待核实候选池 | 173 项通过，新增 PostgreSQL 专项待复验 |
| 销售候选人工转档 | `sales-v1-dev/server/postgres-preview-bank.mjs`、`sales-v1-dev/public/field.js` | 核实、区域权限、去重及来源关联 | 已核实候选 → 正式客户 | 常规回归通过，PostgreSQL 专项待执行 |
