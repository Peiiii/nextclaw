import { afterEach, describe, expect, it, vi } from "vitest";
import * as pluginMutations from "../../../../plugin/plugin-mutation-actions.js";
import { ServiceMarketplaceInstaller } from "../service-marketplace-installer.js";

describe("ServiceCommands marketplace plugin management", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs marketplace plugins in-process instead of spawning a CLI subcommand", async () => {
    const runCliSubcommand = vi.fn<() => Promise<string>>();
    const installer = new ServiceMarketplaceInstaller({
      runCliSubcommand,
      installBuiltinSkill: () => null
    });
    const installSpy = vi.spyOn(pluginMutations, "installPluginMutation").mockResolvedValue({
      message: "Installed plugin: codex",
    });
    const marketplace = installer.createInstaller();

    expect(marketplace.installPlugin).toBeTypeOf("function");
    await expect(marketplace.installPlugin!("@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk")).resolves.toEqual({
      message: "Installed plugin: codex",
    });
    expect(installSpy).toHaveBeenCalledWith("@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk");
    expect(runCliSubcommand).not.toHaveBeenCalled();
  });

  it("manages marketplace plugins in-process instead of spawning a CLI subcommand", async () => {
    const applyLiveConfigReload = vi.fn().mockResolvedValue(undefined);
    const runCliSubcommand = vi.fn<() => Promise<string>>();
    const installer = new ServiceMarketplaceInstaller({
      applyLiveConfigReload,
      runCliSubcommand,
      installBuiltinSkill: () => null
    });
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
    const marketplace = installer.createInstaller();

    expect(marketplace.enablePlugin).toBeTypeOf("function");
    expect(marketplace.disablePlugin).toBeTypeOf("function");
    expect(marketplace.uninstallPlugin).toBeTypeOf("function");

    await expect(marketplace.enablePlugin!("codex")).resolves.toEqual({
      message: 'Enabled plugin "codex".',
    });
    await expect(marketplace.disablePlugin!("codex")).resolves.toEqual({
      message: 'Disabled plugin "codex".',
    });
    await expect(marketplace.uninstallPlugin!("codex")).resolves.toEqual({
      message: 'Uninstalled plugin "codex". Removed: config entry.',
    });

    expect(enableSpy).toHaveBeenCalledWith("codex");
    expect(disableSpy).toHaveBeenCalledTimes(2);
    expect(disableSpy).toHaveBeenNthCalledWith(1, "codex");
    expect(disableSpy).toHaveBeenNthCalledWith(2, "codex");
    expect(uninstallSpy).toHaveBeenCalledWith("codex", { force: true });
    expect(runCliSubcommand).not.toHaveBeenCalled();
    expect(applyLiveConfigReload).toHaveBeenCalledTimes(4);
  });
});
