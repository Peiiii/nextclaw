import { setTimeout as delay } from "node:timers/promises";
import { measureStartupAsync } from "../../../shared/utils/startup-trace.js";
import type { UiStartupHandle } from "./service-gateway-startup.service.js";

const DEFAULT_UI_SHELL_GRACE_MS = 3_000;

export async function waitForUiShellGraceWindow(uiStartup: UiStartupHandle | null): Promise<void> {
  if (!uiStartup) {
    return;
  }
  await measureStartupAsync("service.ui_shell_grace_window", async () => {
    await delay(DEFAULT_UI_SHELL_GRACE_MS);
  });
}
