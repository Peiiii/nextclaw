import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticsCommands } from "../diagnostics.js";
import type { RuntimeStatusReport } from "../../shared/types/cli.types.js";

type DiagnosticsCommandsStatusProbe = {
  collectRuntimeStatus: (params: { verbose: boolean; fix: boolean }) => Promise<RuntimeStatusReport>;
};

describe("DiagnosticsCommands status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("returns zero exit code for stopped JSON status output", async () => {
    const commands = new DiagnosticsCommands({ logo: "🤖" });
    vi.spyOn(
      commands as unknown as DiagnosticsCommandsStatusProbe,
      "collectRuntimeStatus"
    ).mockResolvedValue({
      generatedAt: "2026-03-07T00:00:00.000Z",
      configPath: "/tmp/config.json",
      configExists: true,
      workspacePath: "/tmp/workspace",
      workspaceExists: true,
      model: "test/model",
      providers: [],
      serviceStatePath: "/tmp/service.json",
      serviceStateExists: false,
      fixActions: [],
      process: {
        managedByState: false,
        pid: null,
        running: false,
        staleState: false,
        orphanSuspected: false,
        startedAt: null
      },
      endpoints: {
        uiUrl: null,
        apiUrl: null,
        configuredUiUrl: "http://127.0.0.1:55667",
        configuredApiUrl: "http://127.0.0.1:55667/api"
      },
      health: {
        managed: { state: "unreachable", detail: "service not running" },
        configured: { state: "unreachable", detail: "fetch failed" }
      },
      issues: [],
      recommendations: ["Run nextclaw start to launch the service."],
      logTail: [],
      remote: {
        configuredEnabled: false,
        runtime: null
      },
      level: "stopped",
      exitCode: 0
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.status({ json: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"level": "stopped"'));
    expect(process.exitCode).toBe(0);
  });
});
