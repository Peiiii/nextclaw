import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    loadConfig: mocks.loadConfigMock,
  };
});

import { describeUnmanagedHealthyTargetMessage, inspectUiTarget } from "../service-port-probe.js";

describe("service-port-probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigMock.mockReturnValue({
      ui: {
        enabled: true,
        host: "127.0.0.1",
        port: 55667,
        open: false,
      },
    });
  });

  it("describes a healthy unmanaged service already serving the target port", async () => {
    await expect(
      describeUnmanagedHealthyTargetMessage({
        uiOverrides: {
          enabled: true,
          host: "0.0.0.0",
          open: false,
        },
        checkPortAvailabilityFn: vi.fn().mockResolvedValue({
          available: false,
          detail: "bind failed on 0.0.0.0:55667",
        }),
        probeHealthEndpointFn: vi.fn().mockResolvedValue({
          healthy: true,
          error: null,
        }),
      }),
    ).resolves.toContain("restart only stops the background service recorded in managed state");
  });

  it("classifies a healthy occupied target as reusable", async () => {
    await expect(
      inspectUiTarget({
        host: "0.0.0.0",
        port: 55667,
        healthUrl: "http://127.0.0.1:55667/api/health",
        checkPortAvailabilityFn: vi.fn().mockResolvedValue({
          available: false,
          detail: "bind failed on 0.0.0.0:55667",
        }),
        probeHealthEndpointFn: vi.fn().mockResolvedValue({
          healthy: true,
          error: null,
        }),
      }),
    ).resolves.toEqual({
      state: "healthy-existing",
      availabilityDetail: "bind failed on 0.0.0.0:55667",
      probeError: null,
    });
  });

  it("classifies an unavailable unhealthy target as conflicting", async () => {
    await expect(
      inspectUiTarget({
        host: "0.0.0.0",
        port: 55667,
        healthUrl: "http://127.0.0.1:55667/api/health",
        checkPortAvailabilityFn: vi.fn().mockResolvedValue({
          available: false,
          detail: "bind failed on 0.0.0.0:55667",
        }),
        probeHealthEndpointFn: vi.fn().mockResolvedValue({
          healthy: false,
          error: "connection refused",
        }),
      }),
    ).resolves.toEqual({
      state: "occupied-unhealthy",
      availabilityDetail: "bind failed on 0.0.0.0:55667",
      probeError: "connection refused",
    });
  });

  it("returns null when the target port is unavailable but not serving a healthy nextclaw instance", async () => {
    await expect(
      describeUnmanagedHealthyTargetMessage({
        uiOverrides: {
          enabled: true,
          host: "0.0.0.0",
          open: false,
        },
        checkPortAvailabilityFn: vi.fn().mockResolvedValue({
          available: false,
          detail: "bind failed on 0.0.0.0:55667",
        }),
        probeHealthEndpointFn: vi.fn().mockResolvedValue({
          healthy: false,
          error: "connection refused",
        }),
      }),
    ).resolves.toBeNull();
  });
});
