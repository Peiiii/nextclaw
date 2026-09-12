import { describe, expect, it } from "vitest";
import { ObservationStore } from "./observation-pack-store.config.js";

describe("ObservationStore", () => {
  it("stores and retrieves a value by id", () => {
    const store = new ObservationStore();
    const id = store.store({ data: "hello" }, 100);
    expect(id).toMatch(/^obs-\d+$/);
    const result = store.get(id);
    expect(result).not.toBeNull();
    expect(result!.result).toEqual({ data: "hello" });
    expect(result!.resultBytes).toBe(100);
  });

  it("assigns incrementing ids", () => {
    const store = new ObservationStore();
    const id1 = store.store("a", 1);
    const id2 = store.store("b", 2);
    expect(id1).toBe("obs-1");
    expect(id2).toBe("obs-2");
  });

  it("returns null for unknown id", () => {
    const store = new ObservationStore();
    expect(store.get("obs-999")).toBeNull();
  });

  it("removes a stored entry on delete", () => {
    const store = new ObservationStore();
    const id = store.store("data", 50);
    expect(store.delete(id)).toBe(true);
    expect(store.get(id)).toBeNull();
    expect(store.delete("nonexistent")).toBe(false);
  });

  it("clears all entries and resets id counter", () => {
    const store = new ObservationStore();
    store.store("a", 1);
    store.store("b", 2);
    expect(store.size).toBe(2);
    store.clear();
    expect(store.size).toBe(0);
    const id = store.store("c", 3);
    expect(id).toBe("obs-1");
  });
});
