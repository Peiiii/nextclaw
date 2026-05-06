import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceUiHosts } from "../service-ui-hosts.service.js";

const mocks = vi.hoisted(() => ({
  createRemoteAccessHost: vi.fn(),
  createRuntimeControlHost: vi.fn(),
  createNpmRuntimeUpdateHost: vi.fn()
}));

vi.mock("@/cli/shared/services/ui/service-remote-access.service.js", () => ({
  createRemoteAccessHost: (...args: unknown[]) => mocks.createRemoteAccessHost(...args)
}));

vi.mock("@/cli/shared/services/ui/runtime-control-host.service.js", () => ({
  createRuntimeControlHost: (...args: unknown[]) => mocks.createRuntimeControlHost(...args)
}));

vi.mock("@/cli/shared/services/ui/npm-runtime-update-host.service.js", () => ({
  createNpmRuntimeUpdateHost: (...args: unknown[]) => mocks.createNpmRuntimeUpdateHost(...args)
}));

describe("createServiceUiHosts", () => {
  const originalDisableRuntimeUpdateHost = process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST;

  afterEach(() => {
    vi.clearAllMocks();
    if (originalDisableRuntimeUpdateHost === undefined) {
      delete process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST;
      return;
    }
    process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST = originalDisableRuntimeUpdateHost;
  });

  it("creates the runtime update host by default", () => {
    const remoteAccessHost = { kind: "remote-access" };
    const runtimeControlHost = { kind: "runtime-control" };
    const runtimeUpdateHost = { kind: "runtime-update" };
    mocks.createRemoteAccessHost.mockReturnValue(remoteAccessHost);
    mocks.createRuntimeControlHost.mockReturnValue(runtimeControlHost);
    mocks.createNpmRuntimeUpdateHost.mockReturnValue(runtimeUpdateHost);

    const hosts = createServiceUiHosts({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "127.0.0.1", port: 55667 },
      remoteModule: null
    });

    expect(hosts).toMatchObject({
      remoteAccess: remoteAccessHost,
      runtimeControl: runtimeControlHost,
      runtimeUpdate: runtimeUpdateHost
    });
    expect(mocks.createNpmRuntimeUpdateHost).toHaveBeenCalledTimes(1);
  });

  it("skips the runtime update host when development disables it", () => {
    process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST = "1";
    const remoteAccessHost = { kind: "remote-access" };
    const runtimeControlHost = { kind: "runtime-control" };
    mocks.createRemoteAccessHost.mockReturnValue(remoteAccessHost);
    mocks.createRuntimeControlHost.mockReturnValue(runtimeControlHost);

    const hosts = createServiceUiHosts({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "127.0.0.1", port: 55667 },
      remoteModule: null
    });

    expect(hosts).toMatchObject({
      remoteAccess: remoteAccessHost,
      runtimeControl: runtimeControlHost
    });
    expect(hosts.runtimeUpdate).toBeUndefined();
    expect(mocks.createNpmRuntimeUpdateHost).not.toHaveBeenCalled();
  });
});
