import { describe, expect, it, vi } from "vitest";
import { HostAutostartRuntimeService } from "../host-autostart-runtime.service.js";
import { LinuxSystemdAutostartService } from "../linux-systemd-autostart.service.js";

describe("LinuxSystemdAutostartService", () => {
  it("writes a user unit with explicit NEXTCLAW_HOME and serve command", async () => {
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    const service = new LinuxSystemdAutostartService({
      platform: "linux",
      env: {},
      getHomeDir: () => "/home/alice",
      existsSync: () => false,
      mkdirSync,
      writeFileSync,
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/local/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/srv/nextclaw-home",
      }),
    });

    const result = await service.install("user");

    expect(result.ok).toBe(true);
    expect(result.resourcePath).toBe("/home/alice/.config/systemd/user/nextclaw.service");
    expect(mkdirSync).toHaveBeenCalledWith("/home/alice/.config/systemd/user", { recursive: true });
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const unitFile = writeFileSync.mock.calls[0]?.[1];
    expect(String(unitFile)).toContain("Environment=NEXTCLAW_HOME=/srv/nextclaw-home");
    expect(String(unitFile)).toContain("ExecStart=/usr/local/bin/node /opt/nextclaw/dist/cli/index.js serve");
    expect(runCommand).toHaveBeenNthCalledWith(1, "systemctl", ["--user", "daemon-reload"]);
    expect(runCommand).toHaveBeenNthCalledWith(2, "systemctl", ["--user", "enable", "nextclaw.service"]);
    expect(runCommand).toHaveBeenNthCalledWith(3, "systemctl", ["--user", "restart", "nextclaw.service"]);
  });

  it("reports unsupported status outside linux", async () => {
    const service = new LinuxSystemdAutostartService({
      platform: "darwin",
    });

    const status = await service.status();

    expect(status.supported).toBe(false);
    expect(status.reasonIfUnavailable).toContain("Linux only");
  });

  it("chooses the installed system scope when reading status", async () => {
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "enabled", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "active", stderr: "" });
    const service = new LinuxSystemdAutostartService({
      platform: "linux",
      env: {},
      getHomeDir: () => "/home/alice",
      existsSync: (path) => path === "/etc/systemd/system/nextclaw.service",
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/home/alice/.nextclaw",
      }),
    });

    const status = await service.status();

    expect(status.scope).toBe("system");
    expect(status.installed).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(runCommand).toHaveBeenNthCalledWith(1, "systemctl", ["is-enabled", "nextclaw.service"]);
    expect(runCommand).toHaveBeenNthCalledWith(2, "systemctl", ["is-active", "nextclaw.service"]);
  });

  it("warns when both user and system units are installed and no scope is provided", async () => {
    const service = new LinuxSystemdAutostartService({
      platform: "linux",
      env: {},
      getHomeDir: () => "/home/alice",
      existsSync: (path) =>
        path === "/home/alice/.config/systemd/user/nextclaw.service"
        || path === "/etc/systemd/system/nextclaw.service",
    });

    const status = await service.status();

    expect(status.scope).toBeNull();
    expect(status.reasonIfUnavailable).toContain("--user or --system");
  });

  it("returns doctor warnings when the unit is not installed", async () => {
    const service = new LinuxSystemdAutostartService({
      platform: "linux",
      env: {},
      getHomeDir: () => "/home/alice",
      existsSync: (path) => path === "/usr/bin/node" || path === "/home/alice/.nextclaw",
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/home/alice/.nextclaw",
      }),
    });

    const report = await service.doctor("user");

    expect(report.exitCode).toBe(1);
    expect(report.checks.find((check) => check.name === "unit-file")?.status).toBe("warn");
    expect(report.checks.find((check) => check.name === "exec-path")?.status).toBe("pass");
  });

  it("returns a failed install result when systemctl enable fails", async () => {
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "permission denied" });
    const service = new LinuxSystemdAutostartService({
      platform: "linux",
      env: {},
      getHomeDir: () => "/home/alice",
      existsSync: () => false,
      mkdirSync,
      writeFileSync,
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/local/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/srv/nextclaw-home",
      }),
    });

    const result = await service.install("user");

    expect(result.ok).toBe(false);
    expect(result.reasonIfUnavailable).toContain("permission denied");
    expect(runCommand).toHaveBeenNthCalledWith(1, "systemctl", ["--user", "daemon-reload"]);
    expect(runCommand).toHaveBeenNthCalledWith(2, "systemctl", ["--user", "enable", "nextclaw.service"]);
  });
});
