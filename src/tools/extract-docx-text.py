"""从 docx 中提取纯文本（不依赖第三方库），用于包装资料盘点和证据索引。"""
import sys
import zipfile
import re
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(f"{{{NS['w']}}}p"):
        texts = [t.text or "" for t in p.iter(f"{{{NS['w']}}}t")]
        line = "".join(texts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("media/包装资料")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("data/extracted/packaging")
    out.mkdir(parents=True, exist_ok=True)
    count = 0
    for docx in sorted(src.rglob("*.docx")):
        name = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", docx.stem) + ".txt"
        text = extract(docx)
        (out / name).write_text(text, encoding="utf-8")
        count += 1
        print(f"{docx} -> {out / name} ({len(text)} 字)")
    print(f"共 {count} 个 docx")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
