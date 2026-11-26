# 历史报错与避坑手册（每次编码前必读）

### [2026-11-26-01] 硬编码 Windows 绝对路径（旧机遗留，已修复 4 处）
- **现象**：旧脚本写死 `D:/AI办公/purepaw/...`、`C:/Users/yinho/Desktop/...`，迁到新电脑后全部无法运行。
- **根因**：早期脚本直接用本机绝对路径拼接文件位置。
- **铁律**：脚本内路径一律相对定位 —— Python 用 `Path(__file__).resolve()`，Node 用 `import.meta.url`，PowerShell 用 `$PSScriptRoot`。交付前执行 `grep -rn "D:\\\\\|C:\\\\" src/` 自查。

### [2026-11-26-02] 本机无可用 Python（WindowsApps 占位符）
- **现象**：`python` 指向 Windows 商店占位符，执行即退出（exit 49），无任何报错输出。
- **铁律**：写 Python 脚本前先运行 `python --version` 验证；若环境缺失，须先征得安装同意，交付时明确标注"未实测"。

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
