import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const child = spawn(process.execPath, [
  "--test",
  join(__dirname, "remote-quota-durable-object.test.mjs"),
  join(__dirname, "remote-quota-policy.test.mjs"),
  join(__dirname, "remote-relay-quota-lifecycle.test.mjs")
], {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
