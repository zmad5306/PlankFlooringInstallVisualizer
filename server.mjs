import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8000);
const root = process.cwd();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function fileForUrl(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const requested = resolve(root, `.${safePath}`);
  if (!requested.startsWith(root)) {
    return null;
  }
  if (existsSync(requested) && statSync(requested).isFile()) {
    return requested;
  }
  return join(root, "index.html");
}

const server = createServer((request, response) => {
  const file = fileForUrl(request.url || "/");
  if (!file || !existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] || "application/octet-stream"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Plank floor visualizer running at http://${host}:${port}`);
});
