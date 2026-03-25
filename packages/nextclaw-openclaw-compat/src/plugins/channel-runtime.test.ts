import { describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { mergePluginConfigView, startPluginChannelGateways, toPluginConfigView, type PluginChannelBinding } from "./channel-runtime.js";
import type { PluginRegistry } from "./types.js";

function createRegistry(
  listAccountIds?: (cfg?: Record<string, unknown>) => string[],
  startAccount = vi.fn(async () => undefined)
): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [
      {
        pluginId: "builtin-channel-feishu",
        source: "bundled",
        channel: {
          id: "feishu",
          config: {
            listAccountIds,
          },
          gateway: {
            startAccount,
          },
        },
      },
    ],
    providers: [],
    engines: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: [],
  };
}

function createBinding(): PluginChannelBinding {
  return {
    pluginId: "builtin-channel-feishu",
    channelId: "feishu",
    channel: { id: "feishu" }
  };
}

describe("startPluginChannelGateways", () => {
  it("passes projected plugin config into channel account enumeration", async () => {
    const listAccountIds = vi.fn((cfg?: Record<string, unknown>) => {
      const accounts = (cfg?.channels as Record<string, unknown> | undefined)?.feishu as
        | { accounts?: Record<string, unknown> }
        | undefined;
      return Object.keys(accounts?.accounts ?? {});
    });
    const registry = createRegistry(listAccountIds);
    const config = ConfigSchema.parse({
      plugins: {
        entries: {
          "builtin-channel-feishu": {
            enabled: true,
            config: {
              enabled: true,
              accounts: {
                main: { enabled: true },
                backup: { enabled: true },
              },
            },
          },
        },
      },
    });

    const result = await startPluginChannelGateways({
      registry,
      config,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(listAccountIds).toHaveBeenCalledTimes(1);
    expect(listAccountIds).toHaveReturnedWith(["main", "backup"]);
    expect(result.handles.map((handle) => handle.accountId)).toEqual(["main", "backup"]);
  });

  it("passes projected config and lifecycle helpers into gateway startup", async () => {
    const startAccount = vi.fn(async () => undefined);
    const registry = createRegistry(() => ["default"], startAccount);
    const config = ConfigSchema.parse({
      channels: {
        feishu: {
          enabled: true,
          appId: "top-level-app"
        }
      },
      plugins: {
        entries: {
          "builtin-channel-feishu": {
            enabled: true,
            config: {
              enabled: true,
              appId: "stale-plugin-app"
            }
          }
        }
      }
    });

    const result = await startPluginChannelGateways({
      registry,
      config,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
    });

    expect(startAccount).toHaveBeenCalledTimes(1);
    const firstCall = (startAccount.mock.calls as unknown[][])[0];
    expect(firstCall).toBeTruthy();
    const ctx = firstCall?.[0] as unknown as {
      cfg?: { channels?: { feishu?: { appId?: string } } };
      setStatus?: (status: Record<string, unknown>) => void;
      abortSignal?: AbortSignal;
      runtime?: { info?: (message: string) => void };
    };
    expect(ctx.cfg?.channels?.feishu?.appId).toBe("top-level-app");
    expect(typeof ctx.setStatus).toBe("function");
    expect(typeof ctx.runtime?.info).toBe("function");
    expect(ctx.abortSignal?.aborted).toBe(false);

    await result.handles[0]?.stop?.();
    expect(ctx.abortSignal?.aborted).toBe(true);
  });

  it("skips gateway startup when the projected top-level channel is disabled", async () => {
    const startAccount = vi.fn(async () => undefined);
    const registry = createRegistry(() => ["default"], startAccount);
    const config = ConfigSchema.parse({
      channels: {
        feishu: {
          enabled: false,
          appId: "top-level-app"
        }
      },
      plugins: {
        entries: {
          "builtin-channel-feishu": {
            enabled: true,
            config: {
              enabled: true,
              appId: "stale-plugin-app"
            }
          }
        }
      }
    });

    const result = await startPluginChannelGateways({
      registry,
      config,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(startAccount).not.toHaveBeenCalled();
    expect(result.handles).toEqual([]);
  });
});

describe("plugin channel config projection", () => {
  it("prefers explicit top-level channel config over stale plugin config", () => {
    const config = ConfigSchema.parse({
      channels: {
        feishu: {
          enabled: true,
          appId: "top-level-app",
          appSecret: "top-level-secret"
        }
      },
      plugins: {
        entries: {
          "builtin-channel-feishu": {
            enabled: true,
            config: {
              enabled: true,
              appId: "stale-plugin-app",
              appSecret: "stale-plugin-secret"
            }
          }
        }
      }
    });

    const projected = toPluginConfigView(config, [createBinding()]) as {
      channels: { feishu: { appId: string; appSecret: string; enabled: boolean } };
    };

    expect(projected.channels.feishu.appId).toBe("top-level-app");
    expect(projected.channels.feishu.appSecret).toBe("top-level-secret");
    expect(projected.channels.feishu.enabled).toBe(true);
  });

  it("syncs projected plugin channel writes back into top-level channels", () => {
    const config = ConfigSchema.parse({
      plugins: {
        entries: {
          "builtin-channel-feishu": {
            enabled: true,
            config: {
              enabled: true,
              appId: "old-plugin-app"
            }
          }
        }
      }
    });

    const next = mergePluginConfigView(
      config,
      {
        channels: {
          feishu: {
            enabled: true,
            appId: "new-app",
            appSecret: "new-secret"
          }
        }
      },
      [createBinding()]
    );

    expect(next.channels.feishu.appId).toBe("new-app");
    expect(next.channels.feishu.appSecret).toBe("new-secret");
    expect(next.plugins.entries?.["builtin-channel-feishu"]).toEqual({
      enabled: true
    });
  });
});
