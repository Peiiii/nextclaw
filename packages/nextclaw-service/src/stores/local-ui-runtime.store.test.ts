import { describe, expect, it, vi } from "vitest";
import { LocalUiRuntimeStore } from "./local-ui-runtime.store.js";

describe("LocalUiRuntimeStore", () => {
  it("does not carry remote state across process owners", () => {
    const store = new LocalUiRuntimeStore();
    vi.spyOn(store, "read").mockReturnValue({
      pid: 1000,
      startedAt: "2026-03-22T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      remote: {
        enabled: true,
        mode: "service",
        state: "error",
        lastError: "stale owner error",
        updatedAt: "2026-03-22T00:00:00.000Z"
      }
    });
    vi.spyOn(store, "write").mockImplementation(() => undefined);

    const state = store.writeCurrentProcess(
      {
        host: "127.0.0.1",
        port: 18792
      },
      2000
    );

    expect(state.pid).toBe(2000);
    expect(state.remote).toBeUndefined();
  });
});
