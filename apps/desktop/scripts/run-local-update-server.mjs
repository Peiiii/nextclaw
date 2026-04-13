#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function readRequiredOption(args, key) {
  const value = args[key]?.trim();
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function getContentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".zip":
    case ".bundle":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function resolveRequestPath(rootDir, requestUrl) {
  const rawPath = new URL(requestUrl, "http://127.0.0.1").pathname;
  const relativePath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolvedPath = resolve(rootDir, `.${relativePath}`);
  if (!resolvedPath.startsWith(rootDir)) {
    return null;
  }
  return resolvedPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(readRequiredOption(args, "root"));
  const host = args.host?.trim() || "127.0.0.1";
  const port = Number.parseInt(args.port?.trim() || "43010", 10);
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`Local update server root does not exist or is not a directory: ${rootDir}`);
  }

  const server = createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400).end("Missing request url");
      return;
    }
    const filePath = resolveRequestPath(rootDir, request.url);
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  });

  server.listen(port, host, () => {
    process.stdout.write(`[local-update-server] serving ${rootDir} at http://${host}:${String(port)}\n`);
  });
}

try {
  main();
} catch (error) {
  console.error(`[local-update-server] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
