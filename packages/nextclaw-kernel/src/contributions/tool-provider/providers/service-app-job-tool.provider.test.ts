import { describe, expect, it, vi } from "vitest";
import { ServiceAppJobToolProvider } from "./service-app-job-tool.provider.js";

describe("ServiceAppJobToolProvider", () => {
  it("routes Agent Job inspection and cancellation through the same Agent identity", async () => {
    const manager = {
      listServiceAppJobs: vi.fn(async () => ({ entries: [] })),
      getServiceAppJob: vi.fn(async () => ({ id: "job-1", status: "running" })),
      watchServiceAppJob: vi.fn(async () => ({ job: { id: "job-1" }, events: [], cursor: 0 })),
      cancelServiceAppJob: vi.fn(async () => ({ id: "job-1", status: "cancel-requested" })),
    };
    const provider = new ServiceAppJobToolProvider(
      { resolve: vi.fn(async () => ({ toolRunContext: { agentId: "main" } })) } as never,
      manager as never,
    );

    const tools = await provider.provide({ message: {} } as never);
    expect(tools.map((tool) => tool.name)).toEqual([
      "app_jobs_list", "app_job_inspect", "app_job_watch", "app_job_cancel",
    ]);
    await tools[2]?.execute({ appId: "example.notes", jobId: "job-1", afterSequence: 3 });
    await tools[3]?.execute({ appId: "example.notes", jobId: "job-1" });

    expect(manager.watchServiceAppJob).toHaveBeenCalledWith(
      "example.notes", "job-1", 3, { caller: { surface: "agent", id: "main" } },
    );
    expect(manager.cancelServiceAppJob).toHaveBeenCalledWith(
      "example.notes", "job-1", { caller: { surface: "agent", id: "main" } },
    );
  });
});
