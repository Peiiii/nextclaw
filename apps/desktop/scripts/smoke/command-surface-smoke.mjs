#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { existsSync } from "node:fs";

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return "";
  }
  return process.argv[index + 1]?.trim() ?? "";
}

function runNextclaw(binDir, args, options = {}) {
  const command = process.platform === "win32" ? "nextclaw.cmd" : "nextclaw";
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH ?? ""].filter(Boolean).join(delimiter)
    },
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
    ...options
  });
}

function assertStatus(result, args, allowedStatuses = [0]) {
  if (allowedStatuses.includes(result.status ?? 1)) {
    return;
  }
  throw new Error(
    [
      `nextclaw ${args.join(" ")} failed with exit ${String(result.status ?? 1)}`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter(Boolean).join("\n")
  );
}

function parseJsonOutput(result, args) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`nextclaw ${args.join(" ")} did not print valid JSON: ${String(error)}\n${result.stdout}`);
  }
}

function main() {
  const binDir = readArgValue("--bin-dir");
  if (!binDir) {
    throw new Error("--bin-dir is required.");
  }
  const commandPath = resolve(binDir, process.platform === "win32" ? "nextclaw.cmd" : "nextclaw");
  if (!existsSync(commandPath)) {
    throw new Error(`nextclaw command surface entry is missing: ${commandPath}`);
  }

  const versionResult = runNextclaw(binDir, ["--version"]);
  assertStatus(versionResult, ["--version"]);
  const version = versionResult.stdout.trim();
  if (!version) {
    throw new Error("nextclaw --version printed empty output.");
  }

  const statusArgs = ["status", "--json"];
  const statusResult = runNextclaw(binDir, statusArgs);
  assertStatus(statusResult, statusArgs);
  const status = parseJsonOutput(statusResult, statusArgs);
  if (!status?.generatedAt || !status?.endpoints) {
    throw new Error("nextclaw status --json returned an invalid status report.");
  }

  const doctorArgs = ["doctor", "--json"];
  const doctorResult = runNextclaw(binDir, doctorArgs);
  assertStatus(doctorResult, doctorArgs, [0, 1]);
  const doctor = parseJsonOutput(doctorResult, doctorArgs);
  if (!doctor?.generatedAt || !Array.isArray(doctor.checks)) {
    throw new Error("nextclaw doctor --json returned an invalid doctor report.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        commandPath,
        version,
        statusLevel: status.level,
        doctorExitCode: doctor.exitCode
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
