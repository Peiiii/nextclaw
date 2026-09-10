import { describe, expect, it } from "vitest";
import { ScrollRestorationManager } from "@/shared/lib/navigation-history";

describe("ScrollRestorationManager", () => {
  it("normalizes positions and keeps keys isolated", () => {
    const manager = new ScrollRestorationManager();

    manager.save("first", { x: -1, y: Number.NaN });
    manager.save("second", { x: 12.5, y: 48 });

    expect(manager.read("first")).toEqual({ x: 0, y: 0 });
    expect(manager.read("second")).toEqual({ x: 12.5, y: 48 });
  });

  it("evicts the oldest entry when capacity is exhausted", () => {
    const manager = new ScrollRestorationManager(2);

    manager.save("first", { x: 0, y: 1 });
    manager.save("second", { x: 0, y: 2 });
    manager.save("third", { x: 0, y: 3 });

    expect(manager.read("first")).toBeNull();
    expect(manager.read("second")).toEqual({ x: 0, y: 2 });
    expect(manager.read("third")).toEqual({ x: 0, y: 3 });
  });

  it("removes individual entries and clears the session history", () => {
    const manager = new ScrollRestorationManager();
    manager.save("first", { x: 0, y: 1 });
    manager.save("second", { x: 0, y: 2 });

    manager.delete("first");
    expect(manager.read("first")).toBeNull();
    manager.clear();
    expect(manager.read("second")).toBeNull();
  });
});

it("restores reading memory after reload without reviving deleted entries", () => {
  sessionStorage.clear();
  const first = new ScrollRestorationManager(2, sessionStorage);
  first.save('file:one', { x: 2, y: 200 });
  first.save('file:two', { x: 0, y: 300 });
  const reloaded = new ScrollRestorationManager(2, sessionStorage);
  expect(reloaded.read('file:one')).toEqual({ x: 2, y: 200 });
  reloaded.delete('file:one');
  expect(new ScrollRestorationManager(2, sessionStorage).read('file:one')).toBeNull();
});
