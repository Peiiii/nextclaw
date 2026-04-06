import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("installPluginFromNpmSpec", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:child_process");
  });

  it("uses the current runtime npm cli and preserves raw command output on failure", async () => {
    const spawnMock = vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
        child.stdout.emit("data", "stdout-line\n");
        child.stderr.emit("data", "stderr-line\n");
        child.emit("close", 1);
      });
      return child;
    });

    vi.doMock("node:child_process", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:child_process")>();
      return {
        ...actual,
        spawn: spawnMock
      };
    });

    const { installPluginFromNpmSpec } = await import("./install.js");
    const result = await installPluginFromNpmSpec({
      spec: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk"
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected npm install probe to fail");
    }
    expect(result.error).toContain("npm pack failed:");
    expect(result.error).toContain("stdout-line");
    expect(result.error).toContain("stderr-line");
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [
        expect.stringContaining("npm-cli.js"),
        "pack",
        "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
        "--ignore-scripts"
      ],
      expect.objectContaining({
        cwd: expect.any(String),
        env: expect.any(Object),
        stdio: ["ignore", "pipe", "pipe"]
      })
    );
  });
});
