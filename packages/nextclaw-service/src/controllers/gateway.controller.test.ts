import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config } from "@nextclaw/core";
import { ConfigManager, LlmProviderManager } from "@nextclaw/kernel";
import { GatewayControllerImpl } from "./gateway.controller.js";

describe("GatewayControllerImpl", () => {
  let configDir = "";
  let configPath = "";
  let configManager: ConfigManager;
  let applyReloadPlan: ReturnType<typeof vi.fn>;

  const createBaseConfig = (): Config => ConfigSchema.parse({});

  const writeConfig = (config: Config): void => {
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  };

  const createController = (): GatewayControllerImpl => {
    return new GatewayControllerImpl({
      configManager,
    });
  };

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "nextclaw-gateway-controller-test-"));
    configPath = join(configDir, "config.json");
    writeConfig(createBaseConfig());
    configManager = new ConfigManager({
      configPath,
      channels: {
        enabledChannels: [],
        load: () => undefined,
        reload: async () => undefined,
      } as never,
      providerManager: new LlmProviderManager(),
    });
    applyReloadPlan = vi.spyOn(configManager, "applyReloadPlan");
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it("hot-applies supported config patches without auto-restarting", async () => {
    const controller = createController();
    const snapshot = await controller.getConfig();

    const result = await controller.patchConfig({
      baseHash: typeof snapshot.hash === "string" ? snapshot.hash : undefined,
      raw: JSON.stringify({
        agents: {
          context: {
            bootstrap: {
              perFileChars: 4500
            }
          }
        }
      })
    });

    expect(result).toMatchObject({
      ok: true,
      message: "Config saved and applied.",
      pendingRestart: null,
      changedPaths: ["agents.context.bootstrap.perFileChars"]
    });
    expect(applyReloadPlan).toHaveBeenCalledTimes(1);
    expect(configManager.config.agents.context.bootstrap.perFileChars).toBe(4500);
  });

  it("returns a pending-restart contract for config paths outside the hot-reload plan", async () => {
    const controller = createController();
    const snapshot = await controller.getConfig();

    const result = await controller.patchConfig({
      baseHash: typeof snapshot.hash === "string" ? snapshot.hash : undefined,
      raw: JSON.stringify({
        remote: {
          deviceName: "manual-restart-smoke"
        }
      })
    });

    expect(result).toMatchObject({
      ok: true,
      changedPaths: ["remote.deviceName"],
      pendingRestart: {
        required: true,
        automatic: false,
        changedPaths: ["remote.deviceName"],
        message: "Config saved. Run nextclaw restart in an external terminal to apply: remote.deviceName."
      }
    });
    expect((result as { message?: string }).message).toContain("nextclaw restart");
    expect(applyReloadPlan).toHaveBeenCalledTimes(1);
  });
});
