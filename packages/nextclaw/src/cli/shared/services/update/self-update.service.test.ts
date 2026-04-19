import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
  createExternalCommandEnvMock: vi.fn(() => ({ PATH: "/mock/bin" })),
  findExecutableOnPathMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawnSync: mocks.spawnSyncMock
}));

vi.mock("@nextclaw/core", () => ({
  createExternalCommandEnv: mocks.createExternalCommandEnvMock
}));

vi.mock("../../utils/cli.utils.js", () => ({
  findExecutableOnPath: mocks.findExecutableOnPathMock
}));

import { runSelfUpdate } from "./self-update.service.js";

describe("runSelfUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findExecutableOnPathMock.mockReturnValue("/mock/bin/npm");
  });

  it("skips npm install when the current version already matches the registry latest", () => {
    mocks.spawnSyncMock.mockReturnValueOnce({
      status: 0,
      stdout: "\"0.17.8\"\n",
      stderr: ""
    });

    const result = runSelfUpdate({
      packageName: "nextclaw",
      currentVersion: "0.17.8",
      cwd: "/tmp/project"
    });

    expect(result).toMatchObject({
      ok: true,
      strategy: "noop",
      latestVersion: "0.17.8"
    });
    expect(mocks.spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(mocks.spawnSyncMock).toHaveBeenCalledWith(
      "/mock/bin/npm",
      ["view", "nextclaw", "version", "--json"],
      expect.objectContaining({
        cwd: "/tmp/project",
        encoding: "utf-8",
        stdio: "pipe"
      })
    );
  });

  it("continues with npm install when the registry latest is newer than the current version", () => {
    mocks.spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: "\"0.17.9\"\n",
        stderr: ""
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: ""
      });

    const result = runSelfUpdate({
      packageName: "nextclaw",
      currentVersion: "0.17.8",
      cwd: "/tmp/project"
    });

    expect(result).toMatchObject({
      ok: true,
      strategy: "npm",
      latestVersion: "0.17.9"
    });
    expect(mocks.spawnSyncMock).toHaveBeenCalledTimes(2);
    expect(mocks.spawnSyncMock).toHaveBeenLastCalledWith(
      "/mock/bin/npm",
      ["i", "-g", "nextclaw"],
      expect.objectContaining({
        cwd: "/tmp/project",
        encoding: "utf-8",
        stdio: "pipe"
      })
    );
  });

  it("falls back to npm install when reading the latest version fails", () => {
    mocks.spawnSyncMock
      .mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "network error"
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: ""
      });

    const result = runSelfUpdate({
      packageName: "nextclaw",
      currentVersion: "0.17.8",
      cwd: "/tmp/project"
    });

    expect(result).toMatchObject({
      ok: true,
      strategy: "npm"
    });
    expect(result.latestVersion).toBeUndefined();
    expect(mocks.spawnSyncMock).toHaveBeenCalledTimes(2);
  });
});
