import { describe, expect, it, vi } from "vitest";
import { HostAutostartRuntimeService } from "../host-autostart-runtime.service.js";
import { WindowsTaskAutostartService } from "../windows-task-autostart.service.js";

const decodeEncodedCommand = (args: string[]): string => {
  const encoded = args[args.indexOf("-EncodedCommand") + 1];
  return Buffer.from(encoded, "base64").toString("utf16le");
};

describe("WindowsTaskAutostartService", () => {
  it("writes a launcher script and registers a scheduled task", async () => {
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const runCommand = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "",
      stderr: "",
    });
    const service = new WindowsTaskAutostartService({
      platform: "win32",
      existsSync: () => false,
      mkdirSync,
      writeFileSync,
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "C:\\Program Files\\nodejs\\node.exe",
        argvEntry: "C:\\nextclaw\\dist\\cli\\index.js",
        importMetaUrl: "file:///C:/nextclaw/dist/cli/commands/service/index.js",
        getDataDir: () => "C:\\Users\\alice\\AppData\\Roaming\\nextclaw",
      }),
    });

    const result = await service.install("user");

    expect(result.ok).toBe(true);
    expect(result.resourcePath).toBe("C:\\Users\\alice\\AppData\\Roaming\\nextclaw\\autostart\\nextclaw-host-autostart.cmd");
    const launcher = String(writeFileSync.mock.calls[0]?.[1]);
    expect(launcher).toContain("set \"NEXTCLAW_HOME=C:\\Users\\alice\\AppData\\Roaming\\nextclaw\"");
    expect(launcher).toContain("\"C:\\Program Files\\nodejs\\node.exe\" \"C:\\nextclaw\\dist\\cli\\index.js\" \"serve\"");
    const powershellArgs = runCommand.mock.calls[0]?.[1] as string[];
    const powershellScript = decodeEncodedCommand(powershellArgs);
    expect(powershellScript).toContain("Register-ScheduledTask");
    expect(powershellScript).toContain("Start-ScheduledTask");
    expect(powershellScript).toContain("NextClaw Host Autostart");
  });

  it("reads scheduled task status through PowerShell JSON", async () => {
    const runCommand = vi.fn().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({
        installed: true,
        enabled: true,
        active: true,
        state: "Running",
        taskPath: "\\",
        lastTaskResult: 0,
      }),
      stderr: "",
    });
    const service = new WindowsTaskAutostartService({
      platform: "win32",
      runCommand,
      runtimeService: new HostAutostartRuntimeService({
        nodePath: "C:\\Program Files\\nodejs\\node.exe",
        argvEntry: "C:\\nextclaw\\dist\\cli\\index.js",
        importMetaUrl: "file:///C:/nextclaw/dist/cli/commands/service/index.js",
        getDataDir: () => "C:\\Users\\alice\\AppData\\Roaming\\nextclaw",
      }),
    });

    const status = await service.status();

    expect(status.supported).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(status.resourceName).toBe("NextClaw Host Autostart");
  });

  it("reports unsupported status outside Windows", async () => {
    const service = new WindowsTaskAutostartService({
      platform: "darwin",
    });

    const status = await service.status();

    expect(status.supported).toBe(false);
    expect(status.reasonIfUnavailable).toContain("Windows");
  });
});
