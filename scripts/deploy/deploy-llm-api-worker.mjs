import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const workerDir = resolve(process.cwd(), "workers/nextclaw-provider-gateway-api");
const configPath = resolve(workerDir, "wrangler.toml");

function readArgValue(name) {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index < 0) {
    return null;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    return null;
  }
  return value;
}

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workerDir,
    stdio: options.stdio ?? "inherit",
    input: options.input
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function main() {
  const apiKey = (readArgValue("--api-key") ?? process.env.DASHSCOPE_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("Missing DashScope API key.");
    console.error("Use either:");
    console.error("  1) DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker");
    console.error("  2) pnpm deploy:llm-api-worker -- --api-key ***");
    process.exit(1);
  }

  console.log("[llm-api-worker] Updating Cloudflare secret DASHSCOPE_API_KEY ...");
  runOrThrow(
    "pnpm",
    [
      "exec",
      "wrangler",
      "secret",
      "put",
      "DASHSCOPE_API_KEY",
      "--config",
      configPath
    ],
    {
      stdio: ["pipe", "inherit", "inherit"],
      input: `${apiKey}\n`
    }
  );

  console.log("[llm-api-worker] Deploying worker ...");
  runOrThrow("pnpm", ["exec", "wrangler", "deploy", "--config", configPath]);
  console.log("[llm-api-worker] Deploy completed.");
}

main();
