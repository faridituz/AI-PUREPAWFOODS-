import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, process.argv[2] || "../../output/prototypes/a");
const PORT = Number(process.argv[3] || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") {
      res.writeHead(302, { Location: "/a/en/" });
      return res.end();
    }
    let file = path.join(ROOT, pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const info = await stat(file).catch(() => null);
    if (info?.isDirectory()) file = path.join(file, "index.html");
    const data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const lang = pathname.match(/^\/a\/([a-z]{2})\//)?.[1];
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex, nofollow",
      ...(lang ? { "Content-Language": lang } : {})
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
  }
});

server.listen(PORT, () => console.log(`原型预览 http://localhost:${PORT}/  (根目录 ${ROOT})`));
