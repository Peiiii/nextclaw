import type { OpenClawConfig } from "./nextclaw-sdk/feishu.js";
import { describe, expect, it, vi } from "vitest";

const probeFeishuMock = vi.hoisted(() => vi.fn());
const monitorFeishuProviderMock = vi.hoisted(() => vi.fn());
const stopFeishuMonitorMock = vi.hoisted(() => vi.fn());

vi.mock("./probe.js", () => ({
  probeFeishu: probeFeishuMock,
}));

vi.mock("./monitor.js", () => ({
  monitorFeishuProvider: monitorFeishuProviderMock,
  stopFeishuMonitor: stopFeishuMonitorMock,
}));

import { feishuPlugin } from "./channel.js";

describe("feishuPlugin.status.probeAccount", () => {
  it("uses current account credentials for multi-account config", async () => {
    const cfg = {
      channels: {
        feishu: {
          enabled: true,
          accounts: {
            main: {
              appId: "cli_main",
              appSecret: "secret_main",
              enabled: true,
            },
          },
        },
      },
    } as OpenClawConfig;

    const account = feishuPlugin.config.resolveAccount(cfg, "main");
    probeFeishuMock.mockResolvedValueOnce({ ok: true, appId: "cli_main" });

    const result = await feishuPlugin.status?.probeAccount?.({
      account,
      timeoutMs: 1_000,
      cfg,
    });

    expect(probeFeishuMock).toHaveBeenCalledTimes(1);
    expect(probeFeishuMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "main",
        appId: "cli_main",
        appSecret: "secret_main",
      }),
    );
    expect(result).toMatchObject({ ok: true, appId: "cli_main" });
  });

  it("starts gateway monitor without blocking service startup", async () => {
    let resolveMonitor!: () => void;
    const monitorDone = new Promise<void>((resolve) => {
      resolveMonitor = resolve;
    });
    monitorFeishuProviderMock.mockReturnValueOnce(monitorDone);

    const abortController = new AbortController();
    const ctx = {
      cfg: {
        channels: {
          feishu: {
            enabled: true,
            appId: "cli_default",
            appSecret: "secret_default",
            connectionMode: "websocket",
          },
        },
      } as OpenClawConfig,
      accountId: "default",
      abortSignal: abortController.signal,
      setStatus: vi.fn(),
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
      runtime: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    };

    const timeoutToken = Symbol("timeout");
    const started = await Promise.race([
      feishuPlugin.gateway?.startAccount?.(ctx),
      new Promise<symbol>((resolve) => setTimeout(() => resolve(timeoutToken), 20)),
    ]);

    expect(started).not.toBe(timeoutToken);
    expect(monitorFeishuProviderMock).toHaveBeenCalledWith({
      config: ctx.cfg,
      runtime: ctx.runtime,
      abortSignal: ctx.abortSignal,
      accountId: "default",
    });
    expect(ctx.setStatus).toHaveBeenCalledWith({ accountId: "default", port: null });
    expect(typeof (started as { stop?: () => Promise<void> }).stop).toBe("function");

    abortController.abort();
    resolveMonitor();
    await (started as { stop?: () => Promise<void> }).stop?.();

    expect(stopFeishuMonitorMock).toHaveBeenCalledWith("default");
  });
});
