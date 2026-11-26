# 历史报错与避坑手册（每次编码前必读）

### [初始化-01] Windows 编码与路径规范
- **现象**：Windows 下读写中文文件名或日志易抛出 `UnicodeDecodeError: 'gbk' codec`。
- **铁律**：所有 Python 的 `open()` 必须显式指定 `encoding="utf-8"`；路径操作一律使用 `pathlib.Path`。

### [初始化-02] 乌兹别克斯坦本地网络与代理环境变量
- **现象**：访问部分境外 API（如 OpenAI、Telegram、X）时因本地网络波动或终端未走代理导致超时断连。
- **铁律**：编写外部网络请求脚本时，必须支持读取系统代理环境变量（`HTTP_PROXY` / `HTTPS_PROXY`），且所有 HTTP 请求必须设置 `timeout` 与至少 3 次指数退避重试机制。

### [初始化-03] Neon 数据库空闲休眠断连
- **现象**：后台脚本闲置几分钟后再写入 Neon PostgreSQL 时报错 `SSL connection has been closed unexpectedly`。
- **铁律**：连接数据库必须开启连接池保活（`pool_pre_ping=True`），写入操作外层需包裹断线重连重试逻辑。
