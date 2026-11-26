# 双机交接班日志（HANDOFF.md）

## [2026-11-26] - 本机环境配置与环境自测
- **刚完成**：创建本机 `.env`（媒体盘 `G:/我的云端硬盘/PurePaw_Media`、`TZ=Asia/Tashkent` 已配置）；三通自测：①Drive 媒体盘读写正常 ②Neon TCP+TLS 连通（0.49s，证书 `*.c-5.ap-southeast-1.aws.neon.tech`）③Telegram 未测（Token 为空）。
- **阻塞项**：`DATABASE_URL` 密码被掩码为 `****************`，须替换真实密码后才能做数据库鉴权测试；`TG_BOT_TOKEN`、`TG_ADMIN_CHAT_ID` 为空；`PUREPAW_X_CLIENT_ID/SECRET` 本机仓库无来源（`sales-v1-dev` 不在本机），需从旧电脑复制。
- **下一步**：补全 `.env` 后重跑鉴权自测；旧电脑 Codex `git pull` 后把旧机 `.env` 中缺失参数同步到本机。
- **远程同步结果（2026-11-26）**：Tailscale 显示 `farid 100.101.76.43` 离线（最后在线 20 分钟前），SSH 探测超时，无法自动触发旧机拉取与验证。需人工开机旧电脑并确认 Tailscale 在线；本机已有免密公钥 `thinkpad-newpc-20261125`，可先装到旧机 `authorized_keys`，之后本机即可远程触发 `git pull` 与自检。

## [2026-11-26] - 新电脑（Qoder）归档迁移完成
- **刚完成**：接入远端仓库 `faridituz/AI-PUREPAWFOODS-` 并推送初始化提交；全部散落文件迁入标准目录（根目录仅剩 7 个大脑文档 + 标准文件夹）；修复 4 个脚本的旧机硬编码路径；已安装 Python 3.12.10 并实测 `src/website/prepare_website_update_20261110.py` 通过（输出 HTML 与已提交版本逐字节一致），同时为《网站更新说明》md 加了防覆盖守卫。
- **下一步**：旧电脑 Codex 执行 `git pull` 验证同步；`outputs/` 下历史脚本依赖旧机桌面路径（`C:/Users/yinho/Desktop/包装袋`），重跑前需先改路径。
- **注意事项**：`data/`、`media/` 已加入 `.gitignore`，此后新增文件不再同步 Git（媒体走 `MEDIA_STORAGE_PATH` 云盘，状态走 Neon）；`outputs/`（192 个历史验收证据）按原样保留未改名；Python 若 PATH 未生效，用全路径 `C:\Users\ThinkPad\AppData\Local\Programs\Python\Python312\python.exe`。

## [2026-11-26] - 新电脑（Qoder）初始化
- **刚完成**：完成工作区标准目录、`.gitignore` 防护及 7 个终极版协同大脑配置文档的初始化。
- **下一步**：扫描现有散落文件并整理归位至标准目录，登记至 `INVENTORY.md`，随后推送至 Git 仓库供旧电脑 Codex 自动同步。
