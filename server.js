import { createServer } from "node:http";
import handler from "./dist/server/index.js";

const port = Number(process.env.PORT) || 3000;

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const host = req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  const request = new Request(url.toString(), {
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
