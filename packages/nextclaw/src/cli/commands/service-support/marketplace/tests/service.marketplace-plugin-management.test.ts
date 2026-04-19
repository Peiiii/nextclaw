import { afterEach, describe, expect, it, vi } from "vitest";
import * as pluginMutations from "../../../plugin/plugin-mutation-actions.js";
import { ServiceCommands } from "../../../service/index.js";

const getServiceMethod = <T extends (...args: never[]) => unknown>(service: ServiceCommands, key: string): T => {
  const method = Reflect.get(service as object, key);
  if (typeof method !== "function") {
    throw new Error(`Service method ${key} is not available`);
  }
  return method.bind(service) as T;
};

const setServiceField = (service: ServiceCommands, key: string, value: unknown): void => {
  Reflect.set(service as object, key, value);
};

const getServiceField = <T>(service: ServiceCommands, key: string): T => {
  return Reflect.get(service as object, key) as T;
};

describe("ServiceCommands marketplace plugin management", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs marketplace plugins in-process instead of spawning a CLI subcommand", async () => {
    const service = new ServiceCommands({
      requestRestart: vi.fn().mockResolvedValue(undefined),
    });
    const installSpy = vi.spyOn(pluginMutations, "installPluginMutation").mockResolvedValue({
      message: "Installed plugin: codex",
    });
    const runCliSpy = vi.spyOn(service as never as { runCliSubcommand: () => Promise<string> }, "runCliSubcommand");
    const installMarketplacePlugin = getServiceMethod<(spec: string) => Promise<{ message: string; output?: string }>>(
      service,
      "installMarketplacePlugin",
    );

    await expect(installMarketplacePlugin("@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk")).resolves.toEqual({
      message: "Installed plugin: codex",
    });
    expect(installSpy).toHaveBeenCalledWith("@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk");
    expect(runCliSpy).not.toHaveBeenCalled();
  });

  it("manages marketplace plugins in-process instead of spawning a CLI subcommand", async () => {
    const service = new ServiceCommands({
      requestRestart: vi.fn().mockResolvedValue(undefined),
    });
    setServiceField(service, "applyLiveConfigReload", vi.fn().mockResolvedValue(undefined));
    const enableSpy = vi.spyOn(pluginMutations, "enablePluginMutation").mockResolvedValue({
      message: 'Enabled plugin "codex".',
    });
    const disableSpy = vi.spyOn(pluginMutations, "disablePluginMutation").mockResolvedValue({
      message: 'Disabled plugin "codex".',
    });
    const uninstallSpy = vi.spyOn(pluginMutations, "uninstallPluginMutation").mockResolvedValue({
      message: 'Uninstalled plugin "codex". Removed: config entry.',
      warnings: [],
    });
    const runCliSpy = vi.spyOn(service as never as { runCliSubcommand: () => Promise<string> }, "runCliSubcommand");
    const enableMarketplacePlugin = getServiceMethod<(id: string) => Promise<{ message: string; output?: string }>>(
      service,
      "enableMarketplacePlugin",
    );
    const disableMarketplacePlugin = getServiceMethod<(id: string) => Promise<{ message: string; output?: string }>>(
      service,
      "disableMarketplacePlugin",
    );
    const uninstallMarketplacePlugin = getServiceMethod<(id: string) => Promise<{ message: string; output?: string }>>(
      service,
      "uninstallMarketplacePlugin",
    );

    await expect(enableMarketplacePlugin("codex")).resolves.toEqual({
      message: 'Enabled plugin "codex".',
    });
    await expect(disableMarketplacePlugin("codex")).resolves.toEqual({
      message: 'Disabled plugin "codex".',
    });
    await expect(uninstallMarketplacePlugin("codex")).resolves.toEqual({
      message: 'Uninstalled plugin "codex". Removed: config entry.',
    });

    expect(enableSpy).toHaveBeenCalledWith("codex");
    expect(disableSpy).toHaveBeenCalledTimes(2);
    expect(disableSpy).toHaveBeenNthCalledWith(1, "codex");
    expect(disableSpy).toHaveBeenNthCalledWith(2, "codex");
    expect(uninstallSpy).toHaveBeenCalledWith("codex", { force: true });
    expect(runCliSpy).not.toHaveBeenCalled();
    expect(getServiceField<{ (): Promise<void> }>(service, "applyLiveConfigReload")).toHaveBeenCalledTimes(4);
  });
});
