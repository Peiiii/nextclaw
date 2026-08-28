import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin });

process.stdout.write(`${JSON.stringify({ ready: true, pid: process.pid })}\n`);

lines.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const result = request.operation === "list-actions"
    ? [{ name: "echo", title: "Echo", description: "Minimal Node service action" }]
    : { echoed: request.input ?? {} };
  process.stdout.write(`${JSON.stringify({
    requestId: request.requestId,
    ok: true,
    result,
  })}\n`);
});
