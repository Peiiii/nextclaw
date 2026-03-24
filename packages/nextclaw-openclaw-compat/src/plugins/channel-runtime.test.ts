import { describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { startPluginChannelGateways } from "./channel-runtime.js";
import type { PluginRegistry } from "./types.js";

function createRegistry(listAccountIds?: (cfg?: Record<string, unknown>) => string[]): PluginRegistry {
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
            startAccount: vi.fn(async () => undefined),
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
});
