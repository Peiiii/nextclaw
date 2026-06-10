import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import { RestartCommands } from "@nextclaw-service/controllers/commands/restart-command.controller.js";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  localUiRuntimeStore: {
    read: vi.fn(),
    clearIfOwnedByProcess: vi.fn()
  },
  managedServiceStateStore: {
    read: vi.fn(),
    clear: vi.fn()
  },
  cliUtils: {
    findListeningProcessByPort: vi.fn(),
    isProcessRunning: vi.fn(),
    resolveUiConfig: vi.fn(),
    waitForExit: vi.fn()
  },
  resolveManagedServiceUiOverrides: vi.fn(),
  describeUnmanagedHealthyTargetMessage: vi.fn()
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    loadConfig: mocks.loadConfig
  };
});

vi.mock("@nextclaw-service/stores/local-ui-runtime.store.js", () => ({
  localUiRuntimeStore: mocks.localUiRuntimeStore
}));

vi.mock("@nextclaw-service/stores/managed-service-state.store.js", () => ({
  managedServiceStateStore: mocks.managedServiceStateStore
}));

vi.mock("@nextclaw-service/utils/cli.utils.js", () => ({
  findListeningProcessByPort: (...args: unknown[]) => mocks.cliUtils.findListeningProcessByPort(...args),
  isProcessRunning: (...args: unknown[]) => mocks.cliUtils.isProcessRunning(...args),
  resolveUiConfig: (...args: unknown[]) => mocks.cliUtils.resolveUiConfig(...args),
  waitForExit: (...args: unknown[]) => mocks.cliUtils.waitForExit(...args)
}));

vi.mock("@nextclaw-service/utils/runtime-helpers.utils.js", () => ({
  resolveManagedServiceUiOverrides: (...args: unknown[]) => mocks.resolveManagedServiceUiOverrides(...args)
}));

vi.mock("@nextclaw-service/managers/managed-service.manager.js", () => ({
  describeUnmanagedHealthyTargetMessage: (...args: unknown[]) => mocks.describeUnmanagedHealthyTargetMessage(...args)
}));

describe("RestartCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockReturnValue({
      ui: {
        enabled: true,
        host: "127.0.0.1",
        port: 55667,
        open: false
      }
    });
    mocks.resolveManagedServiceUiOverrides.mockReturnValue({
      enabled: true,
      host: "0.0.0.0",
      open: false
    });
    mocks.cliUtils.resolveUiConfig.mockReturnValue({
      enabled: true,
      host: "0.0.0.0",
      port: 55667,
      open: false
    });
    mocks.cliUtils.findListeningProcessByPort.mockReturnValue(null);
    mocks.cliUtils.waitForExit.mockResolvedValue(true);
    mocks.describeUnmanagedHealthyTargetMessage.mockResolvedValue(null);
    mocks.managedServiceStateStore.read.mockReturnValue(null);
    mocks.localUiRuntimeStore.read.mockReturnValue(null);
    mocks.cliUtils.isProcessRunning.mockReturnValue(false);
  });

  it("restarts a tracked foreground local runtime on the target port before starting the managed service", async () => {
    const processKillSpy = vi.spyOn(process, "kill").mockImplementation(() => true as never);
    const runtimeCommandService = {
      stopService: vi.fn()
    };
    const startCommands = {
      run: vi.fn()
    };
    mocks.localUiRuntimeStore.read.mockReturnValue({
      pid: 46598,
      startedAt: "2026-05-06T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:55667",
      apiUrl: "http://127.0.0.1:55667/api",
      uiHost: "0.0.0.0",
      uiPort: 55667
    });
    mocks.cliUtils.isProcessRunning.mockImplementation((pid: number) => pid === 46598);

    const commands = new RestartCommands({
      runtimeCommandService: runtimeCommandService as never,
      startCommands: startCommands as never,
      forcedPublicHost: "0.0.0.0",
      writeRestartSentinelFromExecContext: vi.fn()
    });

    await commands.run({});

    expect(processKillSpy).toHaveBeenCalledWith(46598, "SIGTERM");
    expect(mocks.localUiRuntimeStore.clearIfOwnedByProcess).toHaveBeenCalledWith(46598);
    expect(runtimeCommandService.stopService).not.toHaveBeenCalled();
    expect(startCommands.run).toHaveBeenCalledWith({});
    processKillSpy.mockRestore();
  });

  it("keeps refusing an unrelated healthy listener when no tracked foreground runtime matches the target port", async () => {
    const runtimeCommandService = {
      stopService: vi.fn()
    };
    const startCommands = {
      run: vi.fn()
    };
    mocks.localUiRuntimeStore.read.mockReturnValue({
      pid: 72081,
      startedAt: "2026-05-06T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792
    });
    mocks.cliUtils.isProcessRunning.mockImplementation((pid: number) => pid === 72081);
    mocks.describeUnmanagedHealthyTargetMessage.mockResolvedValue("healthy unmanaged listener");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const commands = new RestartCommands({
      runtimeCommandService: runtimeCommandService as never,
      startCommands: startCommands as never,
      forcedPublicHost: "0.0.0.0",
      writeRestartSentinelFromExecContext: vi.fn()
    });

    await commands.run({});

    expect(startCommands.run).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "Error: Cannot restart nextclaw because the target UI/API port is already served by a healthy unmanaged instance."
    );
    errorSpy.mockRestore();
  });

  it("adopts a healthy nextclaw listener on the target port when local runtime state is stale", async () => {
    const processKillSpy = vi.spyOn(process, "kill").mockImplementation(() => true as never);
    const runtimeCommandService = {
      stopService: vi.fn()
    };
    const startCommands = {
      run: vi.fn()
    };
    mocks.localUiRuntimeStore.read.mockReturnValue({
      pid: 72081,
      startedAt: "2026-05-06T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792
    });
    mocks.cliUtils.findListeningProcessByPort.mockReturnValue({
      pid: 46598,
      command: "/Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/.nvm/versions/node/v22.16.0/lib/node_modules/nextclaw/dist/cli/app/index.js serve"
    });
    mocks.cliUtils.isProcessRunning.mockImplementation((pid: number) => pid === 46598);
    mocks.describeUnmanagedHealthyTargetMessage.mockResolvedValue("healthy unmanaged listener");

    const commands = new RestartCommands({
      runtimeCommandService: runtimeCommandService as never,
      startCommands: startCommands as never,
      forcedPublicHost: "0.0.0.0",
      writeRestartSentinelFromExecContext: vi.fn()
    });

    await commands.run({});

    expect(mocks.cliUtils.findListeningProcessByPort).toHaveBeenCalledWith(55667);
    expect(processKillSpy).toHaveBeenCalledWith(46598, "SIGTERM");
    expect(startCommands.run).toHaveBeenCalledWith({});
    processKillSpy.mockRestore();
  });
});
