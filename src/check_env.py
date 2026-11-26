# -*- coding: utf-8 -*-
"""三通环境自检：Neon 数据库 / Google Drive 媒体库 / Telegram 告警推送。
用法: python src/check_env.py   （PASS=1 互通，全部通过退出码 0）
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def load_env(path):
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        env[key.strip()] = val.strip().strip('"').strip("'")
    return env


ENV = load_env(ROOT / ".env")
results = []


def record(name, ok, detail=""):
    results.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  {detail}" if detail else ""))


def check_neon():
    dsn = ENV.get("DATABASE_URL", "")
    if not dsn:
        record("Neon数据库", False, ".env 缺少 DATABASE_URL")
        return
    try:
        import psycopg2
    except ImportError:
        record("Neon数据库", False, "缺少 psycopg2 驱动（pip install psycopg2-binary）")
        return
    t0 = time.time()
    try:
        conn = psycopg2.connect(dsn, connect_timeout=15)
        with conn, conn.cursor() as cur:
            cur.execute("SELECT current_database(), version()")
            db, ver = cur.fetchone()
        conn.close()
        record("Neon数据库", True, f"{time.time()-t0:.2f}s 库={db} {ver.split(',')[0]}")
    except Exception as e:
        msg = re.sub(r":[^:@/]+@", ":***@", str(e)).splitlines()[0]
        record("Neon数据库", False, msg)


def check_media():
    raw = ENV.get("MEDIA_STORAGE_PATH", "")
    if not raw:
        record("媒体库", False, ".env 缺少 MEDIA_STORAGE_PATH")
        return
    p = Path(raw)
    if not p.exists():
        record("媒体库", False, f"目录不存在: {p}")
        return
    try:
        test = p / ".pp_check.tmp"
        test.write_text("purepaw-check", encoding="utf-8")
        ok = test.read_text(encoding="utf-8") == "purepaw-check"
        test.unlink()
        record("媒体库", ok, f"读写正常 {p}")
    except Exception as e:
        record("媒体库", False, f"{type(e).__name__}: 写入失败 {p}")


def check_telegram():
    token = ENV.get("TG_BOT_TOKEN", "")
    chat = ENV.get("TG_ADMIN_CHAT_ID", "")
    if not token or not chat:
        record("Telegram告警", False, ".env 缺少 TG_BOT_TOKEN 或 TG_ADMIN_CHAT_ID")
        return
    text = "PUREPAW 环境自测：Neon 数据库 / 媒体库 / Telegram 告警 三通检查 · 测试消息（Asia/Tashkent）"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps({"chat_id": chat, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    last = ""
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                ok = json.loads(resp.read().decode("utf-8")).get("ok")
            if ok:
                record("Telegram告警", True, f"测试消息已发送 chat={chat}")
                return
            last = "API 返回 ok=false"
        except Exception as e:
            last = type(e).__name__
        time.sleep(2 * (2 ** attempt))
    record("Telegram告警", False, f"发送失败（3 次重试）: {last}")


if __name__ == "__main__":
    check_neon()
    check_media()
    check_telegram()
    passed = sum(results)
    print(f"三通自测: {passed}/{len(results)} PASS")
    sys.exit(0 if results and all(results) else 1)
