// Static file server for production — no host restrictions
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const PORT  = process.env.PORT || 8080;
const DIST  = path.join(__dirname, "dist");

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

http.createServer((req, res) => {
  // Strip query string
  let urlPath = req.url.split("?")[0];

  // Resolve file path
  let filePath = path.join(DIST, urlPath);

  // SPA fallback — serve index.html for any non-file route
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    // Cache headers — assets are hashed, index.html never cached
    const isIndex = filePath.endsWith("index.html");
    res.writeHead(200, {
      "Content-Type":  mime,
      "Cache-Control": isIndex ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable",
    });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`AI Swarm v7 running on http://0.0.0.0:${PORT}`);
});
