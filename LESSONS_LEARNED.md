# 历史报错与避坑手册（每次编码前必读）

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
