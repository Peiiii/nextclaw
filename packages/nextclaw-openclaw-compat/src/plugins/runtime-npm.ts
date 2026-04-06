import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { sanitizeNodeOptionsForExternalCommand } from "@nextclaw/core";

export type RuntimeNpmCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  output: string;
};

function resolveRuntimeNpmCliPath(): string {
  const execDir = path.dirname(process.execPath);
  const candidates = process.platform === "win32"
    ? [
        path.join(execDir, "node_modules", "npm", "bin", "npm-cli.js"),
        path.resolve(execDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
      ]
    : [
        path.resolve(execDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
        path.join(execDir, "node_modules", "npm", "bin", "npm-cli.js")
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function createRuntimeNpmEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    NPM_CONFIG_IGNORE_SCRIPTS: "true"
  };
  const sanitizedNodeOptions = sanitizeNodeOptionsForExternalCommand(env.NODE_OPTIONS);
  if (sanitizedNodeOptions) {
    env.NODE_OPTIONS = sanitizedNodeOptions;
  } else {
    delete env.NODE_OPTIONS;
  }
  return env;
}

export async function runRuntimeNpmCommand(args: string[], cwd: string): Promise<RuntimeNpmCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [resolveRuntimeNpmCliPath(), ...args], {
      cwd,
      env: createRuntimeNpmEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      output += text;
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      output += text;
    });
    child.on("close", (code) => { resolve({ code: code ?? 1, stdout, stderr, output }); });
    child.on("error", (error: NodeJS.ErrnoException) => {
      const errorText = String(error);
      resolve({
        code: 1,
        stdout,
        stderr: [stderr, errorText].filter(Boolean).join("\n").trim(),
        output: [output, errorText].filter(Boolean).join("\n").trim()
      });
    });
  });
}
