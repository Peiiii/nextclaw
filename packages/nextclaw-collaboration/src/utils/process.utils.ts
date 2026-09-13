import { spawn } from "node:child_process";

/** Execute a trusted executable directly; platform data never becomes shell code. */
export function execute(
  command: string[],
  input?: string,
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let output = "";
    let error = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command[0]} timed out`));
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 8_000_000) {
        child.kill();
        reject(new Error("CLI output exceeds 8 MB; narrow the source scope"));
      }
    });
    child.stderr.on("data", (chunk) => {
      if (error.length < 500) error += chunk;
    });
    child.once("error", (failure) => {
      clearTimeout(timer);
      reject(failure);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else
        reject(
          new Error(`${command[0]} exited ${code}: ${error.slice(0, 500)}`),
        );
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

export async function executeJson<T>(
  command: string[],
  input?: string,
  cwd?: string,
): Promise<T> {
  return JSON.parse(await execute(command, input, cwd)) as T;
}

export async function readJson<T>(
  command: string[],
  input?: string,
): Promise<T> {
  try {
    return await executeJson<T>(command, input);
  } catch (error) {
    if (
      !/EOF|eof|ECONNRESET|TLS|tls|timed out|timeout|temporarily unavailable/.test(
        String(error),
      )
    )
      throw error;
    return executeJson<T>(command, input);
  }
}
