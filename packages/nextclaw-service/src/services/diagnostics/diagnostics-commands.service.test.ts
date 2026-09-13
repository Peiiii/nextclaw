import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagnosticsCommands } from "./diagnostics-commands.service.js";
import { RuntimeVersionProbeService } from "./runtime-version-probe.service.js";
import type { RuntimeStatusReport } from "@nextclaw-service/types/cli.types.js";
import {
  ConfigSchema,
  RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DISTRIBUTION_ENV,
  RUNTIME_INSTANCE_INSTALLATION_KIND_ENV,
  RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV,
} from "@nextclaw/core";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";

type DiagnosticsCommandsStatusProbe = {
  collectRuntimeStatus: (params: { verbose: boolean; fix: boolean }) => Promise<RuntimeStatusReport>;
  listProviderStatuses: (config: ReturnType<typeof ConfigSchema.parse>) => RuntimeStatusReport["providers"];
  buildDoctorChecks: (report: RuntimeStatusReport, checkPort: { available: boolean; detail: string }) => Array<{ name: string; status: string; detail: string }>;
};

function createStoppedRuntimeStatus(overrides: Partial<RuntimeStatusReport> = {}): RuntimeStatusReport {
  return {
    generatedAt: "2026-03-07T00:00:00.000Z",
    instance: { distribution: "cli", installationKind: null },
    storage: {
      portableDataRoot: null,
      runtimeHome: "/tmp",
      desktopDataDirectory: null,
      desktopLogsDirectory: null,
      runtimeLogsDirectory: "/tmp/logs",
      configPath: "/tmp/config.json",
      workspacePath: "/tmp/workspace",
    },
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
      staleReason: null,
      orphanSuspected: false,
      startedAt: null,
      lease: null,
      lastExit: null,
    },
    endpoints: {
      uiUrl: null,
      apiUrl: null,
      configuredUiUrl: "http://127.0.0.1:55667",
      configuredApiUrl: "http://127.0.0.1:55667/api",
    },
    health: {
      managed: { state: "unreachable", detail: "service not running" },
      configured: { state: "unreachable", detail: "fetch failed" },
    },
    runtime: {
      state: "unavailable",
      version: null,
      source: null,
      apiUrl: null,
      detail: "no reachable local API endpoint",
    },
    extensions: { state: "unavailable", detail: "service not running", runtimes: [] },
    issues: [],
    recommendations: ["Run nextclaw start to launch the service."],
    logTail: [],
    remote: { configuredEnabled: false, runtime: null },
    hostIncident: { latest: null },
    level: "stopped",
    exitCode: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
});

describe("DiagnosticsCommands status", () => {
  it("returns zero exit code for stopped JSON status output", async () => {
    const commands = new DiagnosticsCommands({ logo: "🤖" });
    vi.spyOn(
      commands as unknown as DiagnosticsCommandsStatusProbe,
      "collectRuntimeStatus"
    ).mockResolvedValue(createStoppedRuntimeStatus());
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.status({ json: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"level": "stopped"'));
    expect(process.exitCode).toBe(0);
  });

  it("prints instance and storage facts once in human-readable status", async () => {
    const commands = new DiagnosticsCommands({ logo: "🤖" });
    vi.spyOn(
      commands as unknown as DiagnosticsCommandsStatusProbe,
      "collectRuntimeStatus"
    ).mockResolvedValue(createStoppedRuntimeStatus({
      instance: { distribution: "desktop", installationKind: "portable" },
      storage: {
        portableDataRoot: "/portable/data",
        runtimeHome: "/portable/data/runtime-home",
        desktopDataDirectory: "/portable/data/desktop",
        desktopLogsDirectory: "/portable/data/logs",
        runtimeLogsDirectory: "/portable/data/runtime-home/logs",
        configPath: "/portable/data/runtime-home/config.json",
        workspacePath: "/portable/data/runtime-home/workspace",
      },
      generatedAt: "2026-09-13T00:00:00.000Z",
      serviceStatePath: "/portable/data/runtime-home/run/service.json",
      endpoints: { uiUrl: null, apiUrl: null, configuredUiUrl: "http://127.0.0.1", configuredApiUrl: "http://127.0.0.1/api" },
      configPath: "/portable/data/runtime-home/config.json",
      workspacePath: "/portable/data/runtime-home/workspace",
    }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.status();

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Distribution: desktop (portable)");
    expect(output.match(/Runtime home: \/portable\/data\/runtime-home/g)).toHaveLength(1);
    expect(output.match(/Config: \/portable\/data\/runtime-home\/config.json/g)).toHaveLength(1);
    expect(output.match(/Workspace: \/portable\/data\/runtime-home\/workspace/g)).toHaveLength(1);
  });

  it("reports portable instance storage even when the managed service is stopped", async () => {
    const portableRoot = mkdtempSync(join(tmpdir(), "nextclaw-portable-status-"));
    const portableDataRoot = join(portableRoot, "data");
    const runtimeHome = join(portableDataRoot, "runtime-home");
    try {
      vi.stubEnv("NEXTCLAW_HOME", runtimeHome);
      vi.stubEnv(RUNTIME_INSTANCE_DISTRIBUTION_ENV, "desktop");
      vi.stubEnv(RUNTIME_INSTANCE_INSTALLATION_KIND_ENV, "portable");
      vi.stubEnv(RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV, portableDataRoot);
      vi.stubEnv(RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV, join(portableDataRoot, "desktop"));
      vi.stubEnv(RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV, join(portableDataRoot, "logs"));
      vi.spyOn(managedServiceStateStore, "read").mockReturnValue(null);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      const report = await (new DiagnosticsCommands({ logo: "🤖" }) as unknown as DiagnosticsCommandsStatusProbe)
        .collectRuntimeStatus({ verbose: false, fix: false });

      expect(report.instance).toEqual({ distribution: "desktop", installationKind: "portable" });
      expect(report.storage).toEqual({
        portableDataRoot,
        runtimeHome,
        desktopDataDirectory: join(portableDataRoot, "desktop"),
        desktopLogsDirectory: join(portableDataRoot, "logs"),
        runtimeLogsDirectory: join(runtimeHome, "logs"),
        configPath: join(runtimeHome, "config.json"),
        workspacePath: join(runtimeHome, "workspace"),
      });
      expect(report.configPath).toBe(report.storage.configPath);
      expect(report.workspacePath).toBe(report.storage.workspacePath);
      expect(report.level).toBe("stopped");
    } finally {
      rmSync(portableRoot, { recursive: true, force: true });
    }
  });
});

describe("DiagnosticsCommands diagnostics", () => {
  it("reads the running runtime version from app metadata without a local fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { name: "NextClaw", productVersion: "0.53.0" },
    }), { status: 200 }));
    const probe = new RuntimeVersionProbeService();

    await expect(probe.probe({
      apiUrl: "http://127.0.0.1:18791/api",
      source: "managed-api",
    })).resolves.toEqual({
      state: "ok",
      version: "0.53.0",
      source: "managed-api",
      apiUrl: "http://127.0.0.1:18791/api",
      detail: "running API reported its product version",
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18791/api/app/meta",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not substitute a CLI or pointer version for invalid app metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {},
    }), { status: 200 }));
    const probe = new RuntimeVersionProbeService();

    await expect(probe.probe({
      apiUrl: "http://127.0.0.1:18791/api",
      source: "configured-api",
    })).resolves.toEqual(expect.objectContaining({
      state: "invalid-response",
      version: null,
      source: "configured-api",
    }));
  });

  it("reports OpenCode Zen as configured when it uses anonymous access", () => {
    const commands = new DiagnosticsCommands({ logo: "🤖" });
    const probe = commands as unknown as DiagnosticsCommandsStatusProbe;
    const statuses = probe.listProviderStatuses(ConfigSchema.parse({
      providers: {
        opencode: {
          providerType: "opencode",
          enabled: true,
          apiKey: "",
          apiBase: "https://opencode.ai/zen/v1",
          models: ["opencode/big-pickle"]
        }
      }
    }));

    expect(statuses).toContainEqual(expect.objectContaining({
      name: "OpenCode Zen Free Trial",
      configured: true,
      detail: "anonymous access"
    }));
  });

  it("surfaces unresolved Desktop host incidents through doctor checks", () => {
    const commands = new DiagnosticsCommands({ logo: "🤖" });
    const probe = commands as unknown as DiagnosticsCommandsStatusProbe;
    const checks = probe.buildDoctorChecks({
      configExists: true,
      configPath: "/tmp/config.json",
      extensions: { detail: "ok", runtimes: [], state: "ok" },
      health: { configured: { detail: "ok", state: "ok" }, managed: { detail: "ok", state: "ok" } },
      hostIncident: {
        latest: {
          confidence: "confirmed",
          evidence: [],
          expected: false,
          incidentId: "incident-1",
          observedEndedAt: "2026-08-22T10:00:00.000Z",
          reasonCode: "electron-native-crash",
          recovery: { attempts: 1, status: "restarted" },
          resolution: { status: "unresolved" },
          runId: "run-1",
          schemaVersion: 1,
          startedAt: "2026-08-22T09:59:00.000Z"
        }
      },
      providers: [],
      process: { running: false, staleReason: null, staleState: false },
      workspaceExists: true,
      workspacePath: "/tmp/workspace"
    } as unknown as RuntimeStatusReport, { available: true, detail: "available" });

    expect(checks).toContainEqual({
      name: "desktop-host-incident",
      status: "warn",
      detail: "electron-native-crash (confirmed) at 2026-08-22T10:00:00.000Z"
    });
  });
});
