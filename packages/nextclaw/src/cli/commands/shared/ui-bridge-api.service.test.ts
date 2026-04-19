import { afterEach, describe, expect, it, vi } from "vitest";
import * as utils from "../../shared/utils/cli.utils.js";
import { localUiRuntimeStore } from "../../shared/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "../../shared/stores/managed-service-state.store.js";
import { resolveLocalUiApiBase } from "./ui-bridge-api.service.js";

describe("resolveLocalUiApiBase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers live foreground ui discovery over managed service state", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue({
      pid: 18792,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792
    });
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 55667,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:55667",
      apiUrl: "http://127.0.0.1:55667/api",
      uiHost: "0.0.0.0",
      uiPort: 55667,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockImplementation((pid) => pid === 18792 || pid === 55667);

    expect(resolveLocalUiApiBase()).toBe("http://127.0.0.1:18792");
  });

  it("falls back to managed service state when ui discovery is missing", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue(null);
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 55667,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:55667",
      apiUrl: "http://127.0.0.1:55667/api",
      uiHost: "0.0.0.0",
      uiPort: 55667,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);

    expect(resolveLocalUiApiBase()).toBe("http://127.0.0.1:55667");
  });
});
