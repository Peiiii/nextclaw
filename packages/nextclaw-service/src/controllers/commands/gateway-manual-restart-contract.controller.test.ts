import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, GatewayTool, type Config } from "@nextclaw/core";
import { ConfigManager, LlmProviderManager } from "@nextclaw/kernel";
import { GatewayControllerImpl } from "@nextclaw-service/controllers/gateway.controller.js";
import { pendingRestartStore } from "@nextclaw-service/stores/pending-restart.store.js";
import type { RequestRestartParams } from "@nextclaw-service/types/cli.types.js";

vi.mock("@nextclaw-service/services/runtime/npm-runtime-update-command.service.js", () => ({
  NpmRuntimeUpdateCommandService: class {}
}));

describe("gateway manual restart contract", () => {
  let configDir = "";
  let configPath = "";
  let originalNextclawHome: string | undefined;
  let applyAgentRuntimeConfig: ReturnType<typeof vi.fn<(config: Config) => void>>;
  let requestRestartFromCoordinator: ReturnType<
    typeof vi.fn<() => Promise<{ status: "service-restarted"; message: string }>>
  >;
  let restartRequestService: { requestRestart: (params: RequestRestartParams) => Promise<void> };

  const createBaseConfig = (): Config => ConfigSchema.parse({});

  const writeConfig = (config: Config): void => {
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  };

  const createTool = (): GatewayTool => {
    const channels = {
      enabledChannels: [],
      load: () => undefined,
      reload: async () => undefined,
    } as never;
    const configManager = new ConfigManager({
      configPath,
      channels,
      providerManager: new LlmProviderManager(),
    });
    configManager.installRuntimeHooks({
      applyAgentRuntimeConfig,
      onRestartRequired: (paths) => {
        void restartRequestService.requestRestart({
          changedPaths: paths,
          manualMessage: `已保存以下改动，等待你手动重启后生效：${paths.join(", ")}`,
          mode: "notify",
          reason: `config reload requires restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual"
        });
      }
    });
    const controller = new GatewayControllerImpl({
      configManager,
      channels,
      cron: { status: () => ({ jobs: [] }) } as never,
      requestRestart: async (options) => {
        await restartRequestService.requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true
        });
      }
    });
    return new GatewayTool(controller);
  };

  beforeEach(() => {
    originalNextclawHome = process.env.NEXTCLAW_HOME;
    configDir = mkdtempSync(join(tmpdir(), "nextclaw-gateway-manual-restart-"));
    configPath = join(configDir, "config.json");
    process.env.NEXTCLAW_HOME = configDir;
    pendingRestartStore.clear();
    applyAgentRuntimeConfig = vi.fn();
    requestRestartFromCoordinator = vi.fn(async () => ({
      status: "service-restarted",
      message: "Managed service restarted."
    }));
    restartRequestService = {
      requestRestart: async (params) => {
        if (params.mode === "notify") {
          pendingRestartStore.mark({
            changedPaths: params.changedPaths,
            manualMessage: params.manualMessage,
            reason: params.reason
          });
          return;
        }
        await requestRestartFromCoordinator();
        pendingRestartStore.clear();
      }
    };
    writeConfig(createBaseConfig());
  });

  afterEach(() => {
    pendingRestartStore.clear();
    if (originalNextclawHome === undefined) {
      delete process.env.NEXTCLAW_HOME;
    } else {
      process.env.NEXTCLAW_HOME = originalNextclawHome;
    }
    rmSync(configDir, { recursive: true, force: true });
  });

  it("hot-applies supported gateway config patches without scheduling a restart", async () => {
    const tool = createTool();
    const snapshot = JSON.parse(await tool.execute({ action: "config.get" })) as {
      result: { hash: string };
    };

    const response = JSON.parse(
      await tool.execute({
        action: "config.patch",
        baseHash: snapshot.result.hash,
        raw: JSON.stringify({
          agents: {
            context: {
              bootstrap: {
                perFileChars: 4500
              }
            }
          }
        })
      })
    ) as {
      result: {
        message: string;
        pendingRestart: null;
      };
    };

    expect(response.result.message).toBe("Config saved and applied.");
    expect(response.result.pendingRestart).toBeNull();
    expect(applyAgentRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(requestRestartFromCoordinator).not.toHaveBeenCalled();
    expect(pendingRestartStore.read()).toBeNull();
  });

  it("keeps restart-required gateway config patches pending until the user explicitly restarts", async () => {
    const tool = createTool();
    const snapshot = JSON.parse(await tool.execute({ action: "config.get" })) as {
      result: { hash: string };
    };

    const patchResponse = JSON.parse(
      await tool.execute({
        action: "config.patch",
        baseHash: snapshot.result.hash,
        raw: JSON.stringify({
          remote: {
            deviceName: "manual-restart-smoke"
          }
        })
      })
    ) as {
      result: {
        pendingRestart: {
          required: boolean;
          automatic: boolean;
          changedPaths: string[];
        } | null;
      };
    };

    expect(patchResponse.result.pendingRestart).toMatchObject({
      required: true,
      automatic: false,
      changedPaths: ["remote.deviceName"]
    });
    expect(requestRestartFromCoordinator).not.toHaveBeenCalled();
    expect(pendingRestartStore.read()).toMatchObject({
      changedPaths: ["remote.deviceName"]
    });

    const restartResponse = JSON.parse(await tool.execute({ action: "restart" })) as {
      result: string;
    };

    expect(restartResponse.result).toBe("Restart scheduled");
    expect(requestRestartFromCoordinator).toHaveBeenCalledTimes(1);
    expect(pendingRestartStore.read()).toBeNull();
  });
});
