import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceUiHosts } from "../service-ui-hosts.service.js";

const mocks = vi.hoisted(() => ({
  createRemoteAccessHost: vi.fn(),
  createRuntimeControlHost: vi.fn(),
  createNpmRuntimeUpdateHost: vi.fn(),
  managedServiceStateStore: {
    read: vi.fn()
  }
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

vi.mock("@/cli/shared/stores/managed-service-state.store.js", () => ({
  managedServiceStateStore: mocks.managedServiceStateStore
}));

describe("createServiceUiHosts", () => {
  const originalDisableRuntimeUpdateHost = process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST;
  const originalRuntimeBundleChild = process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD;

  afterEach(() => {
    vi.clearAllMocks();
    mocks.managedServiceStateStore.read.mockReturnValue(null);
    if (originalDisableRuntimeUpdateHost === undefined) {
      delete process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST;
    } else {
      process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST = originalDisableRuntimeUpdateHost;
    }
    if (originalRuntimeBundleChild === undefined) {
      delete process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD;
    } else {
      process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD = originalRuntimeBundleChild;
    }
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
    expect(mocks.createNpmRuntimeUpdateHost).toHaveBeenCalledWith(expect.objectContaining({
      applyRestartMode: "manual-process-restart"
    }));
  });

  it("allows runtime update apply to restart a managed service owned by the current process", () => {
    const remoteAccessHost = { kind: "remote-access" };
    const runtimeControlHost = { kind: "runtime-control" };
    const runtimeUpdateHost = { kind: "runtime-update" };
    mocks.createRemoteAccessHost.mockReturnValue(remoteAccessHost);
    mocks.createRuntimeControlHost.mockReturnValue(runtimeControlHost);
    mocks.createNpmRuntimeUpdateHost.mockReturnValue(runtimeUpdateHost);
    mocks.managedServiceStateStore.read.mockReturnValue({
      pid: process.pid
    });

    createServiceUiHosts({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "127.0.0.1", port: 55667 },
      remoteModule: null
    });

    expect(mocks.createNpmRuntimeUpdateHost).toHaveBeenCalledWith(expect.objectContaining({
      applyRestartMode: "managed-service-restart"
    }));
  });

  it("treats a launcher child on the tracked managed-service port as a managed restart owner", () => {
    const remoteAccessHost = { kind: "remote-access" };
    const runtimeControlHost = { kind: "runtime-control" };
    const runtimeUpdateHost = { kind: "runtime-update" };
    process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD = "1";
    mocks.createRemoteAccessHost.mockReturnValue(remoteAccessHost);
    mocks.createRuntimeControlHost.mockReturnValue(runtimeControlHost);
    mocks.createNpmRuntimeUpdateHost.mockReturnValue(runtimeUpdateHost);
    mocks.managedServiceStateStore.read.mockReturnValue({
      pid: process.pid + 1,
      uiPort: 55667
    });

    createServiceUiHosts({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "127.0.0.1", port: 55667 },
      remoteModule: null
    });

    expect(mocks.createNpmRuntimeUpdateHost).toHaveBeenCalledWith(expect.objectContaining({
      applyRestartMode: "managed-service-restart"
    }));
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
