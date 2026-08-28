import { describe, expect, it, vi } from "vitest";
import { ServiceActionToolProvider } from "./service-action-tool.provider.js";

describe("ServiceActionToolProvider", () => {
  it("exposes only actions explicitly granted to the resolved Agent", async () => {
    const listServiceActions = vi.fn(async () => [
      {
        id: "portable-state.counter_read",
        appId: "portable-state",
        name: "counter_read",
        title: "Read counter",
        risk: "read" as const,
        grantState: "granted" as const,
      },
      {
        id: "portable-state.counter_increment",
        appId: "portable-state",
        name: "counter_increment",
        risk: "write" as const,
        grantState: "not-granted" as const,
      },
    ]);
    const invokeServiceAction = vi.fn(async () => ({ value: 3 }));
    const provider = new ServiceActionToolProvider(
      {
        resolve: vi.fn(async () => ({ toolRunContext: { agentId: "main" } })),
      } as never,
      { listServiceActions, invokeServiceAction } as never,
    );

    const tools = await provider.provide({ message: {} } as never);
    expect(tools).toHaveLength(1);
    expect(listServiceActions).toHaveBeenCalledWith({
      caller: { surface: "agent", agentId: "main" },
    });

    await expect(tools[0]!.execute({})).resolves.toEqual({ value: 3 });
    expect(invokeServiceAction).toHaveBeenCalledWith(
      "portable-state.counter_read",
      { caller: { surface: "agent", agentId: "main" }, input: {} },
    );
  });

  it("rejects non-object tool input before invoking the action", async () => {
    const provider = new ServiceActionToolProvider(
      {
        resolve: vi.fn(async () => ({ toolRunContext: { agentId: "main" } })),
      } as never,
      {
        listServiceActions: vi.fn(async () => [{
          id: "portable-state.counter_read",
          appId: "portable-state",
          name: "counter_read",
          risk: "read",
          grantState: "granted",
        }]),
        invokeServiceAction: vi.fn(),
      } as never,
    );
    const [tool] = await provider.provide({ message: {} } as never);
    await expect(tool!.execute("invalid")).rejects.toThrow(
      "Service Action tool input must be an object",
    );
  });
});
