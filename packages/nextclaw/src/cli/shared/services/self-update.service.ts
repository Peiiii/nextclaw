import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createExternalCommandEnv } from "@nextclaw/core";
import { findExecutableOnPath } from "../utils/cli.utils.js";

const DEFAULT_TIMEOUT_MS = 20 * 60_000;

export type UpdateStep = {
  cmd: string;
  args: string[];
  cwd: string;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type SelfUpdateResult = {
  ok: boolean;
  error?: string;
  strategy: "command" | "npm" | "none" | "noop";
  latestVersion?: string;
  steps: UpdateStep[];
};

export type SelfUpdateOptions = {
  timeoutMs?: number;
  cwd?: string;
  updateCommand?: string;
  packageName?: string;
  currentVersion?: string;
};

export function runSelfUpdate(options: SelfUpdateOptions = {}): SelfUpdateResult {
  const steps: UpdateStep[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const updateCommand = options.updateCommand ?? process.env.NEXTCLAW_UPDATE_COMMAND?.trim();
  const packageName = options.packageName ?? "nextclaw";
  const currentVersion = options.currentVersion?.trim() || null;

  const resolveShellCommand = (command: string): { cmd: string; args: string[] } => {
    if (process.platform === "win32") {
      return { cmd: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command] };
    }
    return { cmd: process.env.SHELL || "sh", args: ["-c", command] };
  };

  const runStep = (
    cmd: string,
    args: string[],
    cwd: string
  ): { ok: boolean; code: number | null; stdout: string; stderr: string } => {
    const result = spawnSync(cmd, args, {
      cwd,
      env: createExternalCommandEnv(process.env),
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: "pipe"
    });
    const stdout = (result.stdout ?? "").toString().slice(0, 4000);
    const stderr = (result.stderr ?? "").toString().slice(0, 4000);
    steps.push({
      cmd,
      args,
      cwd,
      code: result.status,
      stdout,
      stderr
    });
    return { ok: result.status === 0, code: result.status, stdout, stderr };
  };

  const parseLatestVersion = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "string" && parsed.trim() ? parsed.trim() : null;
    } catch {
      return trimmed;
    }
  };

  if (updateCommand) {
    const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
    const shellCommand = resolveShellCommand(updateCommand);
    const ok = runStep(shellCommand.cmd, shellCommand.args, cwd);
    if (!ok.ok) {
      return { ok: false, error: "update command failed", strategy: "command", steps };
    }
    return { ok: true, strategy: "command", steps };
  }

  const npmExecutable = findExecutableOnPath("npm");
  if (npmExecutable) {
    const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
    const latestVersionStep = runStep(npmExecutable, ["view", packageName, "version", "--json"], cwd);
    const latestVersion = latestVersionStep.ok ? parseLatestVersion(latestVersionStep.stdout) : null;
    if (latestVersion && currentVersion && latestVersion === currentVersion) {
      return { ok: true, strategy: "noop", latestVersion, steps };
    }
    const ok = runStep(npmExecutable, ["i", "-g", packageName], cwd);
    if (!ok.ok) {
      return {
        ok: false,
        error: `npm install -g ${packageName} failed`,
        strategy: "npm",
        latestVersion: latestVersion ?? undefined,
        steps
      };
    }
    return { ok: true, strategy: "npm", latestVersion: latestVersion ?? undefined, steps };
  }

  return { ok: false, error: "no update strategy available", strategy: "none", steps };
}
