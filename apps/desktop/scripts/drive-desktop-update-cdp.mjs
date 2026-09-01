#!/usr/bin/env node

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("Usage: node drive-desktop-update-cdp.mjs <remote-debugging-port>");
}

const deadline = Date.now() + 30_000;
let target;
while (Date.now() < deadline) {
  try {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
    if (target) break;
  } catch {
    // The renderer can become debuggable shortly after the desktop API is ready.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!target) throw new Error(`No debuggable Desktop renderer appeared on port ${port}.`);

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});

const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

const download = await request("Runtime.evaluate", {
  expression: `window.nextclawDesktop.downloadUpdate()`,
  awaitPromise: true,
  returnByValue: true,
});
if (download.exceptionDetails) throw new Error(JSON.stringify(download.exceptionDetails));
const snapshot = download.result?.value;
if (snapshot?.status !== "downloaded" || snapshot?.downloadedVersion !== "0.48.0") {
  throw new Error(`Expected the official 0.48.0 update to download, got ${JSON.stringify(snapshot)}.`);
}

const apply = await request("Runtime.evaluate", {
  expression: `void window.nextclawDesktop.applyDownloadedUpdate()`,
  returnByValue: true,
});
if (apply.exceptionDetails) throw new Error(JSON.stringify(apply.exceptionDetails));
process.stdout.write(`${JSON.stringify({ downloadedVersion: snapshot.downloadedVersion, status: snapshot.status })}\n`);
socket.close();
