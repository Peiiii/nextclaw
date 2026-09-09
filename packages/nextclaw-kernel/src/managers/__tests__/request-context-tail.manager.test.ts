import { describe, expect, it, vi } from "vitest";
import { RequestContextTailManager } from "@kernel/managers/request-context-tail.manager.js";

const request = {
  sessionId: "session-1",
  runId: "run-1",
  agentId: "main",
  model: "test-model",
};

describe("RequestContextTailManager", () => {
  it("combines sections in provider registration order and skips empty results", async () => {
    const manager = new RequestContextTailManager();
    manager.register({
      provide: () => [
        { source: "first", trust: "trusted", content: { value: 1 } },
      ],
    });
    manager.register({ provide: () => [] });
    manager.register({
      provide: async () => [
        { source: "third", trust: "untrusted", content: { value: 3 } },
      ],
    });

    await expect(manager.build(request)).resolves.toEqual({
      kind: "model_input_tail",
      sections: [
        { source: "first", trust: "trusted", content: { value: 1 } },
        { source: "third", trust: "untrusted", content: { value: 3 } },
      ],
    });
  });

  it("returns no tail when providers are empty and stops invoking disposed registrations", async () => {
    const manager = new RequestContextTailManager();
    const provide = vi.fn(() => [
      { source: "temporary", trust: "trusted" as const, content: true },
    ]);
    const unregister = manager.register({ provide });

    unregister();

    await expect(manager.build(request)).resolves.toBeUndefined();
    expect(provide).not.toHaveBeenCalled();
  });

  it("samples providers for each build without retaining the previous tail", async () => {
    const manager = new RequestContextTailManager();
    let value = 0;
    manager.register({
      provide: () => [
        {
          source: "changing",
          trust: "trusted",
          content: { value: ++value },
        },
      ],
    });

    await expect(manager.build(request)).resolves.toMatchObject({
      sections: [{ content: { value: 1 } }],
    });
    await expect(manager.build(request)).resolves.toMatchObject({
      sections: [{ content: { value: 2 } }],
    });
  });

  it("clears every provider on dispose", async () => {
    const manager = new RequestContextTailManager();
    const provide = vi.fn(() => [
      { source: "temporary", trust: "trusted" as const, content: true },
    ]);
    manager.register({ provide });

    manager.dispose();

    await expect(manager.build(request)).resolves.toBeUndefined();
    expect(provide).not.toHaveBeenCalled();
  });
});
