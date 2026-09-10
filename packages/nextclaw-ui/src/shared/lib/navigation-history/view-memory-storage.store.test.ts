import { describe, expect, it, vi } from "vitest";
import { ViewMemoryStorage } from "./view-memory-storage.store";

describe("best-effort view memory", () => {
  it("tolerates access denial and quota failures without breaking view actions", () => {
    const unavailable = new ViewMemoryStorage(() => {
      throw new Error("denied");
    });
    expect(unavailable.getItem("view")).toBeNull();
    expect(() => unavailable.setItem("view", "{}")).not.toThrow();
    expect(() => unavailable.removeItem("view")).not.toThrow();
    const quota = new ViewMemoryStorage(
      () =>
        ({
          getItem: () => null,
          setItem: () => {
            throw new Error("quota");
          },
          removeItem: vi.fn(),
        }) as unknown as Storage,
    );
    expect(() => quota.setItem("view", "{}")).not.toThrow();
  });
  it("preserves the existing storage key and serialized state", () => {
    const storage = {
      getItem: vi.fn(() => '{"version":1}'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const memory = new ViewMemoryStorage(() => storage as unknown as Storage);
    expect(memory.getItem("view")).toBe('{"version":1}');
    memory.setItem("view", "snapshot");
    memory.removeItem("view");
    expect(storage.setItem).toHaveBeenCalledWith("view", "snapshot");
    expect(storage.removeItem).toHaveBeenCalledWith("view");
  });
});
