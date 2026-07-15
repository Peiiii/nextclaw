import { spawnSync } from "node:child_process";

const defaultCommandTimeoutMs = 10 * 60 * 1_000;

export function formatUpdateVerificationDuration(durationMs) {
  return `${(durationMs / 1_000).toFixed(1)}s`;
}

export function runUpdateVerificationCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: options.quiet ? "ignore" : "inherit",
    shell: process.platform === "win32",
    timeout: options.timeout ?? defaultCommandTimeoutMs
  });
  if (result.status !== 0 && !options.allowFailure) {
    const exitDescription = result.error?.message ?? `exit code ${String(result.status ?? 1)}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${exitDescription}`);
  }
}

export function runUpdateVerificationStage(label, action) {
  const startedAt = Date.now();
  console.log(`[dev:verify-update] ${label}...`);
  const result = action();
  console.log(
    `[dev:verify-update] ${label} completed in ${formatUpdateVerificationDuration(Date.now() - startedAt)}.`
  );
  return result;
}
