# 历史报错与避坑手册（每次编码前必读）

### [2026-11-26-13] 回归脚本默认参数漏测主题，绿并不代表全覆盖
- **现象**：`qa-layout.mjs` 默认 `--themes a`，单独运行时只测 A 主题（184 组合），报告里的 552 组合需要显式传 `a,b,c`。
- **根因**：开发时把默认值设成单主题，交付命令未带参数。
- **铁律**：回归脚本默认必须覆盖全部主题/语言；报告里的总数要与默认命令实际输出一致。新增主题后先跑默认命令核对计数。

### [2026-11-26-12] 品牌强调色直接用于小字号，对比度不达标
- **现象**：C 原型金铜色 `#b98a3c` 用作 11–12px eyebrow，在米色底上对比度约 2.9:1，低于 WCAG AA 4.5:1。
- **根因**：品牌色只考虑了视觉，没有区分“大面积装饰”和“小字号文字”。
- **铁律**：小字号文字使用同色系加深版本（本次 `--gold-ink:#7a5518`，约 5.3:1）；新主题上线前用对比度公式抽查强调色。

### [2026-11-26-11] `--index` 只改页面 meta，robots.txt 仍全站禁止
- **现象**：生产构建页面已无 noindex，但 robots.txt 仍是 `Disallow: /`，搜索引擎与页面信号自相矛盾。
- **根因**：索引开关只传给了页面模板，robots 文本写死。
- **铁律**：索引/环境这类全局开关必须“单一来源”，所有相关输出（meta、robots、sitemap、manifest）共用同一布尔值；改完用生产模式实跑 `qa-multilingual --prod`。

### [2026-11-26-10] 构建 `--out` 相对脚本目录，易把产物写进 src/
- **现象**：从项目根执行 `--out data/temp/prod-build`，产物实际落在 `src/website-v2/data/temp/prod-build`。
- **根因**：`path.resolve(__dirname, getArg("--out", ...))` 以脚本目录为基准。
- **铁律**：传 `--out` 时按脚本目录换算（如 `../../data/temp/...`）；发现误生成目录立即清理，不留在 `src/`。

### [2026-11-26-09] 限流会污染后续功能测试
- **现象**：表单功能测试中途大量 429，前序非法请求把 5 次/分钟额度耗尽。
- **根因**：测试进程共享真实限流状态。
- **铁律**：功能测试用 `STRESS=1` 的独立服务；限流本身用全新进程单独验证，二者不要混在同一次运行里。

### [2026-11-26-08] Chrome 无头截图小窗口会被抬高，误判手机端横向溢出
- **现象**：`chrome --headless --window-size=390,844` 截图右侧内容被裁掉，看似移动端溢出；实际 CSS 正常。
- **根因**：Windows 下 Chrome 窗口有最小宽度（约 500px），390 被抬高后按 390 裁图，造成"假溢出"。
- **铁律**：移动端断点验证一律用 CDP `Emulation.setDeviceMetricsOverride`（见 `src/website-v2/qa-layout.mjs`），不要用命令行 `--window-size` 小于 500 的截图下结论。

### [2026-11-26-07] 重建静态站报 EBUSY（目录被本地服务占用）
- **现象**：`build-a.mjs` 开头 `rm -rf output/prototypes/a` 报 `EBUSY: resource busy or locked`。
- **根因**：本机预览服务进程仍在运行，Windows 对目录句柄加锁。
- **铁律**：重建生成目录前先停掉 `serve.mjs`（或让生成器输出到临时目录再原子替换）；Windows 下不要假设可删除正在被其他进程使用的目录。

### [2026-11-26-06] 双机 `.env` 不能整文件互相同步
- **现象**：本机 `.env` 的 `MEDIA_STORAGE_PATH` 指向 Google Drive（`G:/我的云端硬盘/PurePaw_Media`），同步到旧机后自测报"目录不存在"——旧机只有 C/D 盘且无 Google Drive。
- **根因**：媒体路径、Python 路径等是"每机不同"的参数，被当成全局常量同步。
- **铁律**：`.env` 中机器相关项（`MEDIA_STORAGE_PATH` 等）必须按机取值：本机用 Drive 路径，旧机回退工作区 `media/` 绝对路径；跨机同步 `.env` 后必须先跑 `check_env.py` 验证，禁止无脑整文件覆盖。

### [2026-11-26-05] SSH 远程执行 PowerShell 复杂引号必碎
- **现象**：`ssh host "powershell -Command \"...长命令...\""` 经 cmd 二次解析后引号错乱，命令静默无输出。
- **根因**：bash -> Windows OpenSSH cmd -> PowerShell 三层引号解析叠加。
- **铁律**：远程 PowerShell 一律用 `-EncodedCommand`（UTF-16LE Base64）传输，本地用 Python 一行生成编码；远程输出统一经 `iconv -f GBK` 或 `[Console]::OutputEncoding=UTF8` 转码再处理。

### [2026-11-26-04] 生成脚本覆盖人工维护的说明文档
- **现象**：重跑 `prepare_website_update_20261110.py` 会把《PurePaw_网站更新说明_20261110.md》覆盖回旧模板，丢失人工补充的发布状态与截图记录。
- **根因**：脚本每次运行都无条件重写该 md。
- **铁律**：凡"人工会持续编辑"的产出文件，生成逻辑必须加存在性守卫（`if not note.exists()`）或写入独立 draft 文件；重跑历史脚前先 `git status` 确认干净。

### [2026-11-26-01] 硬编码 Windows 绝对路径（旧机遗留，已修复 4 处）
- **现象**：旧脚本写死 `D:/AI办公/purepaw/...`、`C:/Users/yinho/Desktop/...`，迁到新电脑后全部无法运行。
- **根因**：早期脚本直接用本机绝对路径拼接文件位置。
- **铁律**：脚本内路径一律相对定位 —— Python 用 `Path(__file__).resolve()`，Node 用 `import.meta.url`，PowerShell 用 `$PSScriptRoot`。交付前执行 `grep -rn "D:\\\\\|C:\\\\" src/` 自查。

### [2026-11-26-02] 本机无可用 Python（WindowsApps 占位符）
- **现象**：`python` 指向 Windows 商店占位符，执行即退出（exit 49），无任何报错输出。
- **铁律**：写 Python 脚本前先运行 `python --version` 验证；若环境缺失，须先征得安装同意，交付时明确标注"未实测"。
- **已解决（2026-11-26）**：已用 winget 用户级安装 Python 3.12.10，路径 `C:\Users\ThinkPad\AppData\Local\Programs\Python\Python312\python.exe`；若终端 PATH 未刷新，直接用该全路径调用。

### [2026-11-26-03] git mv 进入被忽略目录（data/、media/）
- **现象**：`data/`、`media/` 已加入 `.gitignore`；`git mv` 已追踪文件进去后仍保持追踪，但此后在该目录新增的文件不会被同步。
- **铁律**：往忽略目录放"需双机同步"的新文件时必须 `git add -f`；或先确认该文件应走云盘/数据库而非 Git。

### [初始化-01] Windows 编码与路径规范
- **现象**：Windows 下读写中文文件名或日志易抛出 `UnicodeDecodeError: 'gbk' codec`。
- **铁律**：所有 Python 的 `open()` 必须显式指定 `encoding="utf-8"`；路径操作一律使用 `pathlib.Path`。

### [初始化-02] 乌兹别克斯坦本地网络与代理环境变量
- **现象**：访问部分境外 API（如 OpenAI、Telegram、X）时因本地网络波动或终端未走代理导致超时断连。
- **铁律**：编写外部网络请求脚本时，必须支持读取系统代理环境变量（`HTTP_PROXY` / `HTTPS_PROXY`），且所有 HTTP 请求必须设置 `timeout` 与至少 3 次指数退避重试机制。

### [初始化-03] Neon 数据库空闲休眠断连
- **现象**：后台脚本闲置几分钟后再写入 Neon PostgreSQL 时报错 `SSL connection has been closed unexpectedly`。
- **铁律**：连接数据库必须开启连接池保活（`pool_pre_ping=True`），写入操作外层需包裹断线重连重试逻辑。
