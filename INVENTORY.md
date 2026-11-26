# 现有功能与脚本资产清单（禁止重复造轮子）

| 模块名称 | 文件路径 | 核心功能说明 | 输入/输出 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 网站八语更新页生成 | `src/website/prepare_website_update_20261110.py` | 读取上线前备份 HTML 与 Word 源 JSON，生成八语更新版 HTML 及更新说明 md | `output/PurePaw_上线前备份_20261110.html`、`output/website_word_sources_20261110.json` -> `output/PurePaw_网站更新_20261110.html` 等 | 已实测通过（Python 3.12.10，8 语言/19 规格断言全过）；说明 md 已加防覆盖守卫，仅首次生成 |
| SKU docx 批量生成 | `src/tools/gen-sku-docx.mjs` | 按 sku-data 数据批量生成各 SKU 定制 Word 文档 | `data/work/sku-data` -> `data/work/build` | 已通过 `node --check`，未实测 |
| Word XML 校验 | `src/tools/xmlcheck.ps1` | 批量检查解包 docx 的 XML 完整性并输出缺失清单 | `data/work/xmllist.txt` | 已通过语法解析 |
| docx 重新打包 | `src/tools/zip-docx.ps1` | 将 build 目录重新打包为 docx | `data/work/build` -> `outputs/packaging-word` | 已通过语法解析 |
| docx 结构校验 | `src/tools/verify-docx.mjs` | 读取 docx 二进制条目做结构校验 | docx 文件 | 已通过 `node --check` |
| P0-B 浏览器验收 | `src/tools/purepaw-p0b-browser.mjs` | P0-B 阶段浏览器自动化验收 | 验收产物 | 历史验收脚本 |
| QA 浏览器验收 | `src/qa-runtime/browser-acceptance.mjs` | QA 运行时浏览器验收（含证据目录） | `src/qa-runtime/evidence` | 历史验收脚本 |
| 狗粮包装审阅 | `outputs/dog-review/read.py`、`report.py`、`review19.py`、`latest_review.py` | 解析狗粮 Word 源文件并生成审阅报告 | 依赖旧机桌面路径 `C:/Users/yinho/Desktop/包装袋/狗` | 历史脚本，本机不可直接运行 |
| 包装资料审核 | `outputs/packaging-audit/extract.py`、`compare.py`、`report.py`、`create_missing.py` | 包装资料抽取、比对差异、补齐缺失 Word | 依赖旧机桌面路径 `C:/Users/yinho/Desktop/包装袋` | 历史脚本，本机不可直接运行 |
| PSD 批量分析 | `outputs/01a19155/grouped.py`、`reference-layout.py` | PSD/参考版式分析与分组 | 历史输入文件 | 历史脚本 |
