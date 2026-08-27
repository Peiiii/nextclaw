import { describe, expect, it, vi } from "vitest";
import { ServiceAppPackageRuntimeService } from "./service-app-package-runtime.service.js";

const components = [
  { kind: "service", id: "running-a", sourcePath: "/apps/running-a" },
  { kind: "panel", id: "panel-a", sourcePath: "/apps/panel-a" },
  { kind: "service", id: "idle-a", sourcePath: "/apps/idle-a" },
  { kind: "service", id: "running-b", sourcePath: "/apps/running-b" },
] as const;

describe("ServiceAppPackageRuntimeService", () => {
  it("stops every service component and restores only services that were running", async () => {
    const statuses = new Map([
      ["running-a", { status: "running" as const }],
      ["idle-a", { status: "idle" as const }],
      ["running-b", { status: "running" as const }],
    ]);
    const stop = vi.fn(async (serviceId: string) => {
      statuses.set(serviceId, { status: "idle" });
    });
    const restore = vi.fn(async (serviceId: string) => {
      statuses.set(serviceId, { status: "running" });
    });
    const service = new ServiceAppPackageRuntimeService({
      getStatus: (serviceId) => statuses.get(serviceId) ?? { status: "idle" },
      restore,
      stop,
    });

    const rollback = await service.prepareDeactivation([...components]);

    expect(stop.mock.calls.map(([serviceId]) => serviceId)).toEqual([
      "running-a",
      "idle-a",
      "running-b",
    ]);
    await rollback();
    expect(restore.mock.calls.map(([serviceId]) => serviceId)).toEqual([
      "running-a",
      "running-b",
    ]);
  });

  it("restores only previously running services stopped before a later stop failure", async () => {
    const statuses = new Map([
      ["running-a", { status: "running" as const }],
      ["idle-a", { status: "idle" as const }],
      ["running-b", { status: "running" as const }],
    ]);
    const stopError = new Error("running-b stop failed");
    const stop = vi.fn(async (serviceId: string) => {
      if (serviceId === "running-b") throw stopError;
      statuses.set(serviceId, { status: "idle" });
    });
    const restore = vi.fn(async (serviceId: string) => {
      statuses.set(serviceId, { status: "running" });
    });
    const service = new ServiceAppPackageRuntimeService({
      getStatus: (serviceId) => statuses.get(serviceId) ?? { status: "idle" },
      restore,
      stop,
    });

    await expect(service.prepareDeactivation([...components])).rejects.toBe(stopError);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith("running-a");
  });

  it("preserves the stop error and recovery failure when restoration is incomplete", async () => {
    const statuses = new Map([
      ["running-a", { status: "running" as const }],
      ["idle-a", { status: "idle" as const }],
      ["running-b", { status: "running" as const }],
    ]);
    const stopError = new Error("running-b stop failed");
    const stop = vi.fn(async (serviceId: string) => {
      if (serviceId === "running-b") throw stopError;
      statuses.set(serviceId, { status: "idle" });
    });
    const restore = vi.fn(async () => undefined);
    const service = new ServiceAppPackageRuntimeService({
      getStatus: (serviceId) => statuses.get(serviceId) ?? { status: "idle" },
      restore,
      stop,
    });

    const error = await service.prepareDeactivation([...components]).catch((caught) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([
      stopError,
      expect.objectContaining({
        message: expect.stringContaining("running-a runtime 恢复失败"),
      }),
    ]);
  });
});
