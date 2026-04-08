const http = require("http");
const fs   = require("fs");
const path = require("path");
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".json": "application/json",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".ttf":  "font/ttf",
};

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options":        "DENY",
  "Referrer-Policy":        "strict-origin-when-cross-origin",
  "X-XSS-Protection":       "1; mode=block",
};

http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];

  // ── Runtime config endpoint — keys never in JS bundle ──────────────────
  if (urlPath === "/api/config") {
    const cfg = JSON.stringify({
      geminiKey: process.env.GEMINI_KEY || "",
    });
    res.writeHead(200, { "Content-Type":"application/json",
      "Cache-Control":"no-store", ...SEC });
    res.end(cfg);
    return;
  }

  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  const ext     = path.extname(filePath).toLowerCase();
  const mime    = MIME[ext] || "application/octet-stream";
  const isAsset = urlPath.startsWith("/assets/");

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type":  mime,
      "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache, no-store, must-revalidate",
      ...SEC,
    });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => console.log(`AI Swarm v7 ✅ :${PORT}`));
