import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config } from "@nextclaw/core";
import { GatewayControllerImpl } from "./controller.js";

const mocks = vi.hoisted(() => ({
  writeRestartSentinel: vi.fn(async (_payload: unknown) => "/tmp/restart-sentinel.json")
}));

vi.mock("../restart-sentinel.js", () => ({
  parseSessionKey: () => null,
  writeRestartSentinel: (payload: unknown) => mocks.writeRestartSentinel(payload)
}));

describe("GatewayControllerImpl", () => {
  let configDir = "";
  let configPath = "";
  let savedConfigs: Config[] = [];
  let applyReloadPlan: ReturnType<typeof vi.fn<(config: Config) => Promise<void>>>;
  let requestRestart: ReturnType<typeof vi.fn<() => Promise<void>>>;

  const createBaseConfig = (): Config => ConfigSchema.parse({});

  const writeConfig = (config: Config): void => {
    savedConfigs.push(config);
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  };

  const createController = (): GatewayControllerImpl => {
    return new GatewayControllerImpl({
      reloader: {
        getChannels: () => ({ enabledChannels: [] }) as never,
        applyReloadPlan,
        reloadConfig: vi.fn(async () => "Config reload triggered")
      },
      cron: { status: () => ({ jobs: [] }) } as never,
      getConfigPath: () => configPath,
      saveConfig: writeConfig,
      requestRestart
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configDir = mkdtempSync(join(tmpdir(), "nextclaw-gateway-controller-test-"));
    configPath = join(configDir, "config.json");
    savedConfigs = [];
    applyReloadPlan = vi.fn(async () => undefined);
    requestRestart = vi.fn(async () => undefined);
    writeConfig(createBaseConfig());
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
    expect(requestRestart).not.toHaveBeenCalled();
    expect(mocks.writeRestartSentinel).not.toHaveBeenCalled();
    expect(savedConfigs.at(-1)?.agents.context.bootstrap.perFileChars).toBe(4500);
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
        message: "Config saved. Restart manually to apply: remote.deviceName."
      }
    });
    expect((result as { message?: string }).message).toContain("Restart manually");
    expect(applyReloadPlan).toHaveBeenCalledTimes(1);
    expect(requestRestart).not.toHaveBeenCalled();
    expect(mocks.writeRestartSentinel).not.toHaveBeenCalled();
  });
});
