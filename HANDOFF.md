# 双机交接班日志（HANDOFF.md）

## [2026-11-27] - 销售地图档案及照片
- 销售分支 ca66d8e 已推送。隔离 PostgreSQL 档案和照片权限、客户交接撤权通过。173 项回归通过。
- 下一步补地图手工建档、编辑及行政区维护。主服务仍使用 SQLite，无采购或生产变更。

## [2026-11-27] - V2.8 方向确认、发布目录防护加固、开发冻结
- **刚完成**：①核实远端 main 含 `9502508`、`74b5196`，Codex 两个销售系统提交已保留；②加固发布目录删除：`build.mjs` 新增 `assertSafeOut`/`safeRemove`（仅允许 `output/` 严格子目录、拒绝项目根及上级、`realpath` 越界、符号链接/目录联接），`qa-gate.mjs` 扩到 13 场景全过（新增根目录、data、output 本身、junction 4 项）；③只读实测正式站渠道：WhatsApp `wa.me/998999876888`、电话 `+998 95 826 69 99` 与代码一致，邮箱为个人 Gmail 待确认，线上无 Telegram 入口；④提交门禁条件化提案（表单关闭模式）前后对照，**未修改 release-gate.mjs**；⑤记录语言/URL 方向（默认 uz、去掉 `/d/`），未实施；⑥文件归属与双机分支协作方案；⑦更新唯一人工待办清单为 V2.8 核对版；⑧回归全绿（416 页 / 数据 1925 / 多语言 2468 / 表单 53 / 门禁 13）；⑨release 门禁仍 4 通过 9 阻断、退出 1、无 `output/release`。
- **下一步（均需老板批准后执行）**：a) 门禁条件化调整（表单关闭模式）；b) 默认语言 uz 与 `/d/` 去前缀（须先给旧 URL 清单与根域名策略，出 301 映射）；c) 确认官方 Telegram 账号与邮箱；d) 指定回滚包存放位置（建议 `output/rollback/<版本>/`）。材料侧仍需 A 产品实拍、B 数值确认、F 母语审校。
- **注意**：已进入开发冻结；不新增页面/主题/报告；未改正式站、DNS、WordPress；不调用 Codex 额度。

## [2026-11-27] - 销售系统 P1.5 公开候选和转档实测（旧机 Codex 分支）
- 销售分支 c9bedd6 已推送。隔离 PostgreSQL 17.12 实测已有 Geofabrik 公开快照 113 条入池，重导新增 0，正式客户新增 0。虚构候选并发转档只生成一份档案及来源关联。173 项回归通过。
- 下一步补地图完整档案和照片权限，随后继续主入口功能对照。主服务仍是 SQLite，无采购或生产修改。

## [2026-11-27] - V2.7 开发冻结、主数据核验、干净环境接手验证
- **刚完成**：①远端 `87e68c0` 与本地一致、工作区干净、无未提交文件、无 LFS、无密钥入库；②在 `data/temp/clean-clone` 从 GitHub 全新克隆（118MB）实测：构建 416 页、8 语全 200、布局 736/0、数据 1925/0、多语言 2468/0（需 `--origin` 与 `--base` 同端口）、表单 53/0、`--release` 退出码 1 且无 `output/release`；③发现并修复门禁失败不清理旧发布目录的缺陷（现失败即 `rm output/release`）；④新增 `qa-gate.mjs` 9 场景全过；⑤新建条码核对（GS1 PDF 实为 **24 条**，19 映射 / 5 未映射 / 校验位全对）、`barcodes.json`、`audit-barcodes.mjs`；⑥登记 P1-001～P1-006 主数据风险；⑦接口契约草案 + 证据分类建议（未改门禁）；⑧咨询接收端 A/B/C 比较与推荐、SEO 迁移实测方案；⑨`CODEX_REVIEW.md`；⑩Excel 六工作表与人工待办 A–J。
- **最短接手流程**：`git clone https://github.com/faridituz/AI-PUREPAWFOODS-.git` → 确认 `node --version` ≥22（**无需 npm install**）→ `cd src/website-v2 && node build.mjs` → `node serve.mjs ../../output/prototypes 4173` → 打开 `http://localhost:4173/d/uz/`。回归：`node qa-gate.mjs`、`node audit-barcodes.mjs`、`node qa-data.mjs --base http://localhost:4173`、`node qa-multilingual.mjs --base http://localhost:4173`、`node qa-forms.mjs`。门禁：`node build.mjs --release --origin https://new.purepawfoods.com`，**必须退出 1 且不生成 release**。
- **环境差异（必须单独迁移）**：`.env` 不入库，需在新机单独创建 `DATABASE_URL` / `MEDIA_STORAGE_PATH` / `TG_BOT_TOKEN` / `TG_ADMIN_CHAT_ID`，再跑 `python src/check_env.py`（Python 3.12）；旧机媒体路径不能照抄本机 Drive 路径。`data/`、`media/` 增量文件不进 Git，走云盘/`git add -f` 决策。
- **注意**：本次干净目录验证只是本机模拟，**不等同第二台真实电脑验收**；未改正式站/DNS/WordPress；`output/release` 仍不存在；`products.json` 仅为本地候选主数据；五语仍为草稿，en/ru/uz 也无人工审校记录。
- **同步说明**：推送时远端已多出旧机两个销售系统提交（`0d2e708`、`7e1f6e1`，仅改 HANDOFF/INVENTORY/LESSONS 三份文档），已 rebase 保留双方记录，无代码冲突。
- **下一步**：等老板补齐 `output/V2.7_人工待办清单_20261127.md` 的 A/B/E/F/G 项；确认默认语言与最终 URL（是否保留 `/d/` 前缀）；批准表单方案后再调门禁。

## [2026-11-27] - 销售系统 P1.5 候选人工转档（旧机 Codex 分支）
- 销售分支 aa4d00a 已同步。候选必须人工核实并通过区域、负责人及去重检查；来源关联随档案一并保存。
- 173 项回归通过，新增 PostgreSQL HTTP 专项尚待运行。下一步实测离线导入和转档成功路径，再做主入口对照。无采购或生产变更。
- 背景（同日更早）：销售仓库 feature/sales-v1 本地提交 e49390e 接通 PostgreSQL 离线 OSM 候选入口；PostgreSQL 专项因项目路径含中文，initdb 后置阶段报 UTF8 0xb0，暂未到达 HTTP，日志留在本地 data。

## [2026-11-26] - V2.6 收口：八语证据、资料核验、发布门禁
- **刚完成**：①正式站八语逐语截图留档（`output/evidence/live-langs/`，8/8，含选择器与首段标题），确认正式站是同一 URL 内 8 个语言面板、无独立语言路径；②31 个真实素材全量盘点（`materials.json`，含 SHA-256、docx 元数据、SKU/规格、可公开范围）；③`check-sources.mjs` 用 19 份数据稿反向核验 products.json 295 项，发现 3 处 `100--125g` 双连字符、1 处俄语 `≥0.91%`、1 处俄语表头截断；④small-dog-beef 专项查明：6–8kg、低活动量、每日 g/天，双连字符为笔误但牛肉无单连字符版本，包装日期不可考，继续阻断；⑤证据登记扩到 22 项，新增 EAN 重复风险与名称差异；⑥品牌页新增八语 GCP/GLN“非质量认证”说明；⑦发布门禁 13 项上线，当前 4 通过 9 阻断，`--release` 不写任何文件；`qa-release.mjs` 在原型 D 上识别 7 项泄漏。
- **验证**：构建 416 页；qa-layout 736 组合 0 异常；qa-multilingual 2,468 项 0 失败；qa-data 1,925 项 0 失败；qa-forms 53 项 0 失败。
- **下一步**：老板补齐 M-01～M-09（产品实拍/标签、清真证书、经销政策、法律文本、生产地址、小犬喂食确认、母语审校、条码核对、包装版本日期）；逐条把 content-log 改 approved、products 改 verified 后，用 `node build.mjs --release --origin https://<已批准域名>` 出包，再跑 `qa-release.mjs output/release`。
- **注意事项**：D 只是候选，未做视觉验收；A/B/C 仅本地档案，禁入发布包；原型与新增翻译仍为草稿且 noindex；本机 RPS 不得外推正式主机；未改正式站/DNS/账号，未接真实 CRM。预览服务仍在 4173。

## [2026-11-26] - V2.5 综合方案 D、真实数据管线与上线准备
- **刚完成**：新增综合主题 `d`（A 的国际质感 + B 的信任转化 + C 的招商逻辑，统一品牌视觉/字体/按钮/间距/动效/多语切换），四主题共 416 页；`products.json` 成为唯一数字源（9 项营养、喂食表、规格、动物占比），构建期校验 + `qa-data.mjs` 反向比对 1,925 项；新增证据登记表 `evidence.json`（16 条，5 状态）与内容发布记录 `content-log.json`（7 条，全部未批准）；品牌页补公司法定信息（地址/生产地/STIR/GCP/GLN）。全部回归 0 失败：版式 736 组合、多语言 2,468 项、数据 1,925 项、表单 53 项、压测 13 场景；文档 7 份见 `output/V2.5_*`。
- **重要更正**：正式站实为 **8 语同页**（非此前误报的 3 语），已修正 `languages.json`/证据登记/QA 断言/语言报告，并在报告中写明更正原因。
- **今日新修**：D 主题 404 正则遗漏（`[abc]`→`[abcd]`）、RTL 下净含量数字乱序（`<bdi dir="ltr">` 包裹）、线上"哈拉认证"与"确认库存配送"两项无凭证宣称已从文案移除。
- **下一步**：等老板补齐 8 项材料（产品实拍/反面标签 7 SKU、哈拉等证书原图、经销商政策、公司法定英文名与税号核对、隐私政策与条款、母语审校、旧 URL 清单、D 方案定稿确认）；拿到后先跑 `content-log` 审批再构建，预览部署需单独批准。
- **注意事项**：未改正式站/DNS/账号；未接真实 CRM；原型与新增翻译仍为草稿且全站 noindex；本机 RPS 不得外推 GoDaddy 生产；`kaa`/`tr` 关闭不公开；预览服务 4173（`STRESS=1`）仍在运行。

## [2026-11-26] - V2.4 三原型、表单、全量测试与文档交付
- **刚完成**：统一构建器 `build.mjs` 生成 A/B/C × 8 语 × 13 类 = 312 页，共享内容/组件/表单/SEO/安全模块；新增询价与经销商表单（前后端共用校验、限流、蜜罐、幂等、mock API、脱敏日志）；8 语言含 RTL 与本地化 404；`--index` 生产索引开关与 `qa-multilingual --prod` 上线闸门。全部自动化回归 0 失败：版式 552 组合、多语言 1,895 项（测试+生产各一次）、表单 44 项、压测 12 场景；3G 模拟原型 LCP 600–840ms，线上 996ms。
- **交付文档**（`output/`）：六语与八语差异、三原型统一架构、测试复测与多语言、表单安全、本机压测、购买心理反向审计、SEO 与索引保护、缺陷修复与未验证、成本对比与设计建议、Codex 交接材料、交付清单（共 11 份）。
- **今日新修**：BUG-09 C 主题小字对比度、BUG-10 C 首页双招商 CTA、BUG-11 `--index` 与 robots 矛盾；复测均通过。
- **下一步**：等老板提供真实营养/喂食/包装/证书/经销政策与母语审校；选 B 为主站、C 为招商页、A 为品牌页；获批准后先部署子域预览，再评估主域切换。
- **注意事项**：未改正式站/DNS/账号权限；未接真实 CRM、未发真实客户消息；生产承载未验证，本机 RPS 不得外推；`kaa`/`tr` 为关闭状态候选语言，不得擅自公开；上线前必须补旧 URL 301 映射。压测服务与临时 4176 端口已停止，日常预览仍在 4173（`STRESS=1`）。

## [2026-11-26] - 原型 A 交付：8语统一静态架构落地
- **刚完成**：`src/website-v2/build-a.mjs` 生成 104 页（13类×8语），内容源为线上8语真实文案提取（`content/site.json`），界面词条 `content/ui.json` 为原型草稿翻译。每语言独立 URL、9个hreflang、canonical、RTL、语言切换保页；原型全站 noindex。本地预览 `node src/website-v2/serve.mjs` → http://localhost:4173/a/en/ 。
- **实测**：英文首页 9,965B（gzip 2.4KB）对比线上 173,031B（gzip 23.6KB）；120组合（8语×390/768/1440×5页）横向溢出0；0断链；移动3G模拟 LCP 544–676ms vs 线上920ms，CLS=0。报告：`output/原型A交付与测试报告_20261126.md`，截图 `output/prototypes/evidence/`。
- **下一步**：方案 B（信任转化）、方案 C（品牌+招商）原型；咨询/招商表单（前端校验+防重复，先接模拟接口）；本地 10/50/100 并发压测（Node 脚本）。
- **注意事项**：新增词条为草稿翻译，上线前须母语复核；未放任何产品实拍图/视频；WP/Cloudflare/GoDaddy 仍无登录会话（浏览器跳转登录页，未绕过），服务器资源仍标未验证。重建原型前先停 `serve.mjs`，否则 Windows 目录被占用导致 EBUSY。

## [2026-11-26] - 官网现状审计完成（V2.2 第一批）
- **刚完成**：公网只读审计 purepawfoods.com，报告在 `output/官网现状审计报告_20261126.md`。实测：WordPress(Twenty Twenty-Five + DesignSetGo) + Cloudflare + GoDaddy 网关；**线上为 8 语同页**（en/zh/ru/ar/uz/kk/ky/tg），非指令所称 6 语；HTML 173KB（内联 CSS 109KB，gzip 23.5KB）；八语正文 46KB 全部一次性加载；HTML 缓存 31 天（抓取时 Age 15.9 天）；无 hreflang、`html lang=en-US`、无表单（仅 wa.me/tel/mailto）；仅首页 1 个正式页，`/sample-page/`、`/hello-world/` 遗留可访问。
- **老板已定**：①保留全部 8 语；②可提供 GoDaddy+WP+Cloudflare 全套权限（待安全交接）；③压测在本机+本地副本做。
- **下一步**：等凭据交接后出服务器资源报告；随后按 V2.1 出三套原型（8 语统一架构），原型阶段再定 A=WordPress 改造 / B=静态生成。
- **注意事项**：不得删除/合并任何语言；服务器资源数据在拿到权限前一律标"未验证"；不要在聊天窗粘贴明文密码，写入 `data/secure/hosting.env`（已 gitignore）。

## [2026-11-26] - 电源策略：15 分钟自动息屏
- **刚完成**：本机与旧机均设置"15 分钟无操作自动息屏"（交流/电池均 900s）；旧机额外将睡眠、休眠设为永不（AC/DC），根治后台节点反复掉线。
- **注意事项**：旧机电池模式下同样永不休眠；如需恢复默认，可执行 `powercfg /change standby-timeout-ac 30` 等命令调整。

## [2026-11-26] - Telegram 告警接入，双机三通 100% 完成
- **刚完成**：`.env` 补齐 `TG_BOT_TOKEN`/`TG_ADMIN_CHAT_ID`；新建 `src/check_env.py`；本机自测 **3/3 PASS**（Neon 2.06s / 媒体盘读写正常 / Telegram 测试消息送达）。`.env` 已 scp 至旧机并经远程验证 **3/3 PASS**（Neon 1.44s / 媒体盘回退 `D:/AI办公/purepaw/media` 读写正常 / Telegram 送达）。旧机已装 Python 3.12.10（`C:\Users\yinho\AppData\Local\Programs\Python\Python312\python.exe`）与 psycopg2-binary。
- **下一步**：X 开发者凭据待申请；数据库业务表设计待启动（结构变更先出方案）。
- **注意事项**：旧机无 Google Drive，其 `.env` 的 `MEDIA_STORAGE_PATH` 必须保持 `D:/AI办公/purepaw/media`，双机同步 `.env` 时**勿整文件覆盖**旧机路径；`check_env.py` 每次运行会真实发送一条 Telegram 测试消息；`.env` 含密钥已被 `.gitignore` 屏蔽。

## [2026-11-26] - 本机环境配置与环境自测
- **刚完成**：创建本机 `.env`（媒体盘 `G:/我的云端硬盘/PurePaw_Media`、`TZ=Asia/Tashkent` 已配置）；三通自测：①Drive 媒体盘读写正常 ②Neon TCP+TLS 连通（0.49s）③Neon 鉴权通过（补真实密码后 2.26s，PostgreSQL 18.7，库 `neondb`，public 表 0 个=空库）。Telegram 未测（Token 为空）。
- **阻塞项**：`TG_BOT_TOKEN`、`TG_ADMIN_CHAT_ID` 为空；X 参数确认本机与旧机均无真实值（旧机 `.env.example` 为有意留空的占位符），需在 X 开发者平台重新申请。
- **下一步**：补齐 Telegram 两值后自测告警通道；数据库为空库，业务表结构需在后续任务中设计建表（涉及表结构变更须先出方案并经确认）。
- **远程同步结果（2026-11-26 已打通）**：旧机 `farid 100.101.76.43` 上线后，本机经 Tailscale SSH（用户 `yinho`，密钥免密）成功触发旧机 `git pull`（`a7ad637 -> 949ef45`）并完成远程验证：7 份大脑文档齐全、5 个标准目录齐全、HEAD 一致（`949ef45`）。旧机 git 路径 `C:\Users\yinho\.qoder\bin\git\cmd\git.exe`（不在非交互 PATH 中，远程调用需全路径）；旧机 python 仅为商店占位符、node 可用。旧机仓库无任何 `.env`（根目录/sales-v1-dev/.local 均无），`.env.example` 中 `PUREPAW_X_CLIENT_ID/SECRET` 为有意留空的占位符，无真实密钥可提取。

## [2026-11-26] - 新电脑（Qoder）归档迁移完成
- **刚完成**：接入远端仓库 `faridituz/AI-PUREPAWFOODS-` 并推送初始化提交；全部散落文件迁入标准目录（根目录仅剩 7 个大脑文档 + 标准文件夹）；修复 4 个脚本的旧机硬编码路径；已安装 Python 3.12.10 并实测 `src/website/prepare_website_update_20261110.py` 通过（输出 HTML 与已提交版本逐字节一致），同时为《网站更新说明》md 加了防覆盖守卫。
- **下一步**：旧电脑 Codex 执行 `git pull` 验证同步；`outputs/` 下历史脚本依赖旧机桌面路径（`C:/Users/yinho/Desktop/包装袋`），重跑前需先改路径。
- **注意事项**：`data/`、`media/` 已加入 `.gitignore`，此后新增文件不再同步 Git（媒体走 `MEDIA_STORAGE_PATH` 云盘，状态走 Neon）；`outputs/`（192 个历史验收证据）按原样保留未改名；Python 若 PATH 未生效，用全路径 `C:\Users\ThinkPad\AppData\Local\Programs\Python\Python312\python.exe`。

## [2026-11-26] - 新电脑（Qoder）初始化
- **刚完成**：完成工作区标准目录、`.gitignore` 防护及 7 个终极版协同大脑配置文档的初始化。
- **下一步**：扫描现有散落文件并整理归位至标准目录，登记至 `INVENTORY.md`，随后推送至 Git 仓库供旧电脑 Codex 自动同步。
