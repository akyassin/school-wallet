import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import handler from "./dist/server/index.js";

const port = Number(process.env.PORT) || 3000;
const clientDir = resolve("dist/client");

const MIME = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".map": "application/json",
};

// TanStack Start serves client assets under the "/_build" base path.
const CLIENT_BASE = "/_build";

function tryServeStatic(pathname, res) {
  const relativePath = pathname.startsWith(CLIENT_BASE + "/")
    ? pathname.slice(CLIENT_BASE.length)
    : pathname;

  const filePath = join(clientDir, relativePath);

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
  } catch {
    return false;
  }

  const mime = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const isImmutable = pathname.startsWith(CLIENT_BASE + "/assets/");

  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": isImmutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  // Serve static assets — both /_build/... and bare paths (favicon, robots, etc.)
  if (pathname.startsWith(CLIENT_BASE + "/") || extname(pathname)) {
    if (tryServeStatic(pathname, res)) return;
  }

  // SSR — forward everything else to TanStack Start
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const host = req.headers.host ?? `localhost:${port}`;
  const request = new Request(new URL(req.url ?? "/", `http://${host}`).toString(), {
    method: req.method,
    headers: req.headers,
    body: body.length > 0 && req.method !== "GET" && req.method !== "HEAD" ? body : null,
  });

  try {
    const response = await handler.fetch(request, {});
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    res.writeHead(response.status, headers);
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
