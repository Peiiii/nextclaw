import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import { markLocalUiRuntimeIfStarted } from "./service-startup-support.service.js";

const originalNextclawHome = process.env.NEXTCLAW_HOME;

describe("markLocalUiRuntimeIfStarted", () => {
  let tempHome = "";

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "nextclaw-ui-runtime-state-"));
    process.env.NEXTCLAW_HOME = tempHome;
  });

  afterEach(() => {
    if (originalNextclawHome) {
      process.env.NEXTCLAW_HOME = originalNextclawHome;
    } else {
      delete process.env.NEXTCLAW_HOME;
    }
    if (tempHome) {
      rmSync(tempHome, { recursive: true, force: true });
      tempHome = "";
    }
  });

  it("writes local ui discovery without touching managed service state", () => {
    markLocalUiRuntimeIfStarted({
      uiStartup: {},
      uiConfig: {
        host: "0.0.0.0",
        port: 18792
      }
    });

    expect(managedServiceStateStore.read()).toBeNull();
    expect(localUiRuntimeStore.read()).toMatchObject({
      pid: process.pid,
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792
    });
  });
});
