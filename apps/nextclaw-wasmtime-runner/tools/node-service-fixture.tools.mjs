import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const dataDirectory = readOption("--data-directory");
const counterPath = dataDirectory ? path.join(dataDirectory, "counter.json") : null;

if (dataDirectory) mkdirSync(dataDirectory, { recursive: true });

const lines = createInterface({ input: process.stdin });

process.stdout.write(`${JSON.stringify({ ready: true, pid: process.pid })}\n`);

lines.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const result = handle(request);
  process.stdout.write(`${JSON.stringify({
    requestId: request.requestId,
    ok: true,
    result,
  })}\n`);
});

function handle(request) {
  if (request.operation === "list-actions") {
    return [
      { name: "counter_read", title: "Read counter", description: "Read the persisted fixture counter" },
      { name: "counter_increment", title: "Increment counter", description: "Persist an incremented fixture counter" },
    ];
  }
  if (request.operation === "invoke" && request.actionName === "counter_increment") {
    const step = Number.isInteger(request.input?.step) ? request.input.step : 1;
    const counter = readCounter() + step;
    writeCounter(counter);
    return { counter, step, persistedBy: "node.fixture" };
  }
  if (request.operation === "invoke" && request.actionName === "counter_read") {
    return { counter: readCounter(), persistedBy: "node.fixture" };
  }
  return { echoed: request.input ?? {} };
}

function readCounter() {
  if (!counterPath) return 0;
  try {
    const value = JSON.parse(readFileSync(counterPath, "utf8"));
    return Number.isSafeInteger(value.counter) ? value.counter : 0;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

function writeCounter(counter) {
  if (!counterPath) return;
  // The fixture performs the same externally observable work as the WASM
  // sample: read a persisted counter, serialize the next value, and write it.
  writeFileSync(counterPath, `${JSON.stringify({ counter })}\n`, "utf8");
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
