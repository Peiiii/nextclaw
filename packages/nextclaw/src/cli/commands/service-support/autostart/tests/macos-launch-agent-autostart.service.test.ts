import { describe, expect, it, vi } from "vitest";
import { HostAutostartRuntimeService } from "../host-autostart-runtime.service.js";
import { MacosLaunchAgentAutostartService } from "../macos-launch-agent-autostart.service.js";

describe("MacosLaunchAgentAutostartService", () => {
  it("writes a launch agent plist and bootstraps the current GUI session", async () => {
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 113, stdout: "", stderr: "not loaded" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    const service = new MacosLaunchAgentAutostartService({
      platform: "darwin",
      env: {},
      getHomeDir: () => "/Users/alice",
      getUid: () => 501,
      existsSync: () => false,
      mkdirSync,
      writeFileSync,
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/local/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/Users/alice/.nextclaw",
      }),
    });

    const result = await service.install("user");

    expect(result.ok).toBe(true);
    expect(result.resourcePath).toBe("/Users/alice/Library/LaunchAgents/io.nextclaw.host-agent.plist");
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const plist = String(writeFileSync.mock.calls[0]?.[1]);
    expect(plist).toContain("<key>Label</key><string>io.nextclaw.host-agent</string>");
    expect(plist).toContain("<key>RunAtLoad</key><true/>");
    expect(plist).toContain("<key>KeepAlive</key><true/>");
    expect(plist).toContain("<key>NEXTCLAW_HOME</key>");
    expect(plist).toContain("<string>/Users/alice/.nextclaw</string>");
    expect(runCommand).toHaveBeenNthCalledWith(1, "launchctl", ["print", "gui/501"]);
    expect(runCommand).toHaveBeenNthCalledWith(2, "launchctl", ["bootout", "gui/501/io.nextclaw.host-agent"]);
    expect(runCommand).toHaveBeenNthCalledWith(3, "launchctl", [
      "bootstrap",
      "gui/501",
      "/Users/alice/Library/LaunchAgents/io.nextclaw.host-agent.plist",
    ]);
  });

  it("reads enabled and active state from launchctl status", async () => {
    const resourcePath = "/Users/alice/Library/LaunchAgents/io.nextclaw.host-agent.plist";
    const runCommand = vi.fn()
      .mockResolvedValueOnce({
        code: 0,
        stdout: `\n\tdisabled services = {\n\t\t"io.nextclaw.host-agent" => enabled\n\t}\n`,
        stderr: "",
      })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "state = running", stderr: "" });
    const service = new MacosLaunchAgentAutostartService({
      platform: "darwin",
      env: {},
      getHomeDir: () => "/Users/alice",
      getUid: () => 501,
      existsSync: (path) => path === resourcePath,
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "/usr/local/bin/node",
        argvEntry: "/opt/nextclaw/dist/cli/index.js",
        importMetaUrl: "file:///opt/nextclaw/dist/cli/commands/service.js",
        getDataDir: () => "/Users/alice/.nextclaw",
      }),
    });

    const status = await service.status();

    expect(status.supported).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(status.resourcePath).toBe(resourcePath);
  });

  it("reports unsupported status outside macOS", async () => {
    const service = new MacosLaunchAgentAutostartService({
      platform: "linux",
    });

    const status = await service.status();

    expect(status.supported).toBe(false);
    expect(status.reasonIfUnavailable).toContain("macOS");
  });
});
