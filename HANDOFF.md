# 双机交接班日志（HANDOFF.md）

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
