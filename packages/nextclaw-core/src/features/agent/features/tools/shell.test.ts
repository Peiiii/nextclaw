import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ExecTool } from "./shell.js";
import { createExternalCommandEnv, sanitizeNodeOptionsForExternalCommand } from "../../utils/child-process-env.js";

describe("ExecTool", () => {
  it("returns structured success output with stdout and stderr preserved", async () => {
    const runner = vi.fn(async () => ({ stdout: "hello\n", stderr: "warn\n" }));
    const tool = new ExecTool({}, runner);

    const result = await tool.execute({ command: "echo hello" });

    expect(result).toMatchObject({
      ok: true,
      command: "echo hello",
      exitCode: 0,
      errorCode: null,
      signal: null,
      stdout: "hello\n",
      stderr: "warn\n",
      stdoutTruncated: false,
      stderrTruncated: false
    });
  });

  it("returns structured failure output with stdout, stderr, and exit metadata preserved", async () => {
    const error = Object.assign(new Error('Command failed: sh -lc "echo OUT; echo ERR 1>&2; exit 7"\nERR\n'), {
      code: 7,
      signal: null,
      killed: false,
      stdout: "OUT\n",
      stderr: "ERR\n"
    });
    const runner = vi.fn(async () => {
      throw error;
    });
    const tool = new ExecTool({}, runner);

    const result = await tool.execute({ command: "sh -lc \"echo OUT; echo ERR 1>&2; exit 7\"" });

    expect(result).toMatchObject({
      ok: false,
      exitCode: 7,
      errorCode: null,
      signal: null,
      stdout: "OUT\n",
      stderr: "ERR\n",
      killed: false,
      timedOut: false,
      message: 'Command failed: sh -lc "echo OUT; echo ERR 1>&2; exit 7"\nERR\n'
    });
  });

  it("returns structured blocked results for safety guard failures", async () => {
    const runner = vi.fn(async () => ({ stdout: "ok", stderr: "" }));
    const tool = new ExecTool({}, runner);

    const result = await tool.execute({ command: "rm -rf /tmp/demo" });

    expect(result).toEqual({
      ok: false,
      command: "rm -rf /tmp/demo",
      workingDir: process.cwd(),
      exitCode: null,
      errorCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      durationMs: 0,
      timedOut: false,
      killed: false,
      stdoutTruncated: false,
      stderrTruncated: false,
      message: "Error: Command blocked by safety guard (dangerous pattern detected)",
      blocked: true,
      blockedReason: "dangerous_pattern"
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("removes development node conditions before launching external commands", async () => {
    const runner = vi.fn(async () => ({ stdout: "ok", stderr: "" }));
    const tool = new ExecTool({}, runner);
    const originalNodeOptions = process.env.NODE_OPTIONS;

    process.env.NODE_OPTIONS = "--trace-warnings --conditions=development --max-old-space-size=4096";

    try {
      const result = await tool.execute({ command: "nextclaw cron list" });

      expect(result).toMatchObject({
        ok: true,
        stdout: "ok",
        stderr: ""
      });
      expect(runner).toHaveBeenCalledWith(
        "nextclaw cron list",
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_OPTIONS: "--trace-warnings --max-old-space-size=4096"
          })
        })
      );
    } finally {
      if (typeof originalNodeOptions === "string") {
        process.env.NODE_OPTIONS = originalNodeOptions;
      } else {
        delete process.env.NODE_OPTIONS;
      }
    }
  });

  it("passes windowsHide on Windows to avoid flashing cmd windows", async () => {
    const runner = vi.fn(async () => ({ stdout: "ok", stderr: "" }));
    const tool = new ExecTool({}, runner);
    const originalPlatform = process.platform;

    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const result = await tool.execute({ command: "echo hello" });

      expect(result).toMatchObject({
        ok: true,
        stdout: "ok",
        stderr: ""
      });
      expect(runner).toHaveBeenCalledWith(
        "echo hello",
        expect.objectContaining({
          windowsHide: true,
        }),
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });
});

describe("createExternalCommandEnv", () => {
  it("drops NODE_OPTIONS entirely when only the development condition is present", () => {
    expect(createExternalCommandEnv({ NODE_OPTIONS: "--conditions=development" }).NODE_OPTIONS).toBeUndefined();
  });

  it("keeps other node options untouched", () => {
    expect(sanitizeNodeOptionsForExternalCommand("--trace-warnings --max-old-space-size=4096")).toBe(
      "--trace-warnings --max-old-space-size=4096"
    );
  });

  it("augments PATH with the current node bin dir and ancestor node_modules bins", () => {
    const workspace = mkdtempSync(join(tmpdir(), "nextclaw-external-env-"));
    const nestedDir = join(workspace, "apps", "demo");
    const rootNodeModulesBin = join(workspace, "node_modules", ".bin");
    const nestedNodeModulesBin = join(workspace, "apps", "node_modules", ".bin");
    mkdirSync(rootNodeModulesBin, { recursive: true });
    mkdirSync(nestedNodeModulesBin, { recursive: true });
    mkdirSync(nestedDir, { recursive: true });

    try {
      const env = createExternalCommandEnv(
        { PATH: "/usr/bin:/bin" },
        {},
        { cwd: nestedDir },
      );
      const pathEntries = String(env.PATH ?? "").split(":");

      expect(pathEntries).toContain("/usr/bin");
      expect(pathEntries).toContain("/bin");
      expect(pathEntries).toContain(dirname(process.execPath));
      expect(pathEntries).toContain(nestedNodeModulesBin);
      expect(pathEntries).toContain(rootNodeModulesBin);
      expect(pathEntries.indexOf(nestedNodeModulesBin)).toBeLessThan(
        pathEntries.indexOf(rootNodeModulesBin),
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
