import { describe, expect, it, vi } from "vitest";
import { DisposableOwner, DisposableStore, toDisposable } from "../index.js";

class TestDisposableOwner extends DisposableOwner {
  registerCleanup = (cleanup: () => void): (() => void) => this.addCleanup(cleanup);

  registerDirectCleanup = (cleanup: () => void): void => {
    this.cleanups.push(cleanup);
  };

  registerDisposable = <T extends { dispose: () => void }>(disposable: T): T => this.addDisposable(disposable);

  isOwnerDisposed = (): boolean => this.isDisposed;
}

describe("DisposableOwner", () => {
  it("runs registered cleanups once and clears them", () => {
    const owner = new TestDisposableOwner();
    const first = vi.fn();
    const second = vi.fn();

    owner.registerCleanup(first);
    owner.registerDirectCleanup(second);

    owner.dispose();
    owner.dispose();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(owner.isOwnerDisposed()).toBe(true);
  });

  it("runs cleanup immediately when registered after dispose", () => {
    const owner = new TestDisposableOwner();
    const cleanup = vi.fn();

    owner.dispose();
    owner.registerCleanup(cleanup);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("disposes registered disposable objects", () => {
    const owner = new TestDisposableOwner();
    const disposable = { dispose: vi.fn() };

    expect(owner.registerDisposable(disposable)).toBe(disposable);
    owner.dispose();

    expect(disposable.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("DisposableStore", () => {
  it("runs disposable objects once", () => {
    const store = new DisposableStore();
    const cleanup = vi.fn();
    const disposable = toDisposable(cleanup);

    store.add(disposable);
    store.dispose();
    store.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
