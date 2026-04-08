// Static file server for production — hardened with security headers
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

const SECURITY_HEADERS = {
  "X-Content-Type-Options":  "nosniff",
  "X-Frame-Options":         "DENY",
  "Referrer-Policy":         "strict-origin-when-cross-origin",
  "Permissions-Policy":      "geolocation=(), camera=(), microphone=()",
  "X-XSS-Protection":        "1; mode=block",
};

http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  let filePath = path.join(DIST, urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  // SPA fallback
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  const ext      = path.extname(filePath).toLowerCase();
  const mime     = MIME[ext] || "application/octet-stream";
  const isIndex  = filePath.endsWith("index.html");
  const isAsset  = urlPath.startsWith("/assets/");

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }

    res.writeHead(200, {
      "Content-Type":  mime,
      "Cache-Control": isAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache, no-store, must-revalidate",
      ...SECURITY_HEADERS,
    });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`AI Swarm v7 ✅ http://0.0.0.0:${PORT}`);
});
