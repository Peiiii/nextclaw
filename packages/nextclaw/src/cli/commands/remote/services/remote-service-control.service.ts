import { getConfigPath, loadConfig } from "@nextclaw/core";
import type { RemoteServiceAction, RemoteServiceActionResult, RemoteServiceView } from "@nextclaw/server";
import { spawn } from "node:child_process";
import { isProcessRunning, resolveUiApiBase, resolveUiConfig } from "../../../shared/utils/cli.utils.js";
import { managedServiceStateStore } from "../../../shared/stores/managed-service-state.store.js";

export type RemoteAccessHostServiceCommands = {
  startService: (options: { uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>; open: boolean }) => Promise<void>;
  stopService: () => Promise<void>;
};

export type RemoteRuntimeController = {
  start: () => Promise<void> | null;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
};

type CurrentUi = {
  host: string;
  port: number;
};

type RemoteServiceControlDeps = {
  serviceCommands: RemoteAccessHostServiceCommands;
  requestManagedServiceRestart: (options?: { uiPort?: number; reason?: string }) => Promise<void>;
  currentUi?: CurrentUi;
  remoteRuntimeController?: RemoteRuntimeController | null;
};

const FORCED_PUBLIC_UI_HOST = "0.0.0.0";

export function resolveRemoteServiceView(currentUi?: CurrentUi): RemoteServiceView {
  if (currentUi) {
    return {
      running: true,
      currentProcess: true,
      pid: process.pid,
      uiUrl: resolveUiApiBase(currentUi.host, currentUi.port),
      uiPort: currentUi.port
    };
  }

  const serviceState = managedServiceStateStore.read();
  const serviceRunning = Boolean(serviceState && isProcessRunning(serviceState.pid));
  return {
    running: serviceRunning,
    currentProcess: Boolean(serviceRunning && serviceState?.pid === process.pid),
    ...(serviceState?.pid ? { pid: serviceState.pid } : {}),
    ...(serviceState?.uiUrl ? { uiUrl: serviceState.uiUrl } : {}),
    ...(typeof serviceState?.uiPort === "number" ? { uiPort: serviceState.uiPort } : {})
  };
}

export async function controlRemoteService(
  action: RemoteServiceAction,
  deps: RemoteServiceControlDeps
): Promise<RemoteServiceActionResult> {
  if (deps.remoteRuntimeController) {
    return controlCurrentProcessRuntime(action, deps.remoteRuntimeController);
  }

  return controlManagedService(action, deps);
}

async function controlCurrentProcessRuntime(
  action: RemoteServiceAction,
  controller: RemoteRuntimeController
): Promise<RemoteServiceActionResult> {
  if (action === "start") {
    await controller.start();
    return { accepted: true, action, message: "Remote runtime started." };
  }
  if (action === "stop") {
    await controller.stop();
    return { accepted: true, action, message: "Remote runtime stopped." };
  }
  await controller.restart();
  return { accepted: true, action, message: "Remote runtime restarted." };
}

async function controlManagedService(
  action: RemoteServiceAction,
  deps: RemoteServiceControlDeps
): Promise<RemoteServiceActionResult> {
  const state = managedServiceStateStore.read();
  const running = Boolean(state && isProcessRunning(state.pid));
  const currentProcess = Boolean(running && state?.pid === process.pid);
  const uiOverrides = resolveManagedUiOverrides();

  if (action === "start") {
    if (running) {
      return {
        accepted: true,
        action,
        message: currentProcess ? "Managed service is already running for this UI." : "Managed service is already running."
      };
    }
    await deps.serviceCommands.startService({ uiOverrides, open: false });
    return { accepted: true, action, message: "Managed service started." };
  }

  if (!running) {
    if (action === "restart") {
      await deps.serviceCommands.startService({ uiOverrides, open: false });
      return {
        accepted: true,
        action,
        message: "Managed service was not running and has been started."
      };
    }
    return { accepted: true, action, message: "No managed service is currently running." };
  }

  if (currentProcess) {
    if (action === "restart") {
      await deps.requestManagedServiceRestart({ uiPort: uiOverrides.port ?? 55667 });
    } else {
      scheduleManagedSelfStop();
    }
    return {
      accepted: true,
      action,
      message:
        action === "restart"
          ? "Restart scheduled. This page may disconnect for a few seconds."
          : "Stop scheduled. This page will disconnect shortly."
    };
  }

  if (action === "stop") {
    await deps.serviceCommands.stopService();
    return { accepted: true, action, message: "Managed service stopped." };
  }

  await deps.serviceCommands.stopService();
  await deps.serviceCommands.startService({ uiOverrides, open: false });
  return { accepted: true, action, message: "Managed service restarted." };
}

function resolveManagedUiOverrides(): Partial<ReturnType<typeof resolveUiConfig>> {
  const config = loadConfig(getConfigPath());
  const resolved = resolveUiConfig(config, {
    enabled: true,
    host: FORCED_PUBLIC_UI_HOST,
    open: false
  });
  return {
    enabled: true,
    host: FORCED_PUBLIC_UI_HOST,
    open: false,
    port: resolved.port
  };
}

function scheduleManagedSelfStop(): void {
  launchManagedSelfControl();
}

function launchManagedSelfControl(params: {
  command?: string;
  args?: string[];
} = {}): void {
  const script = [
    'const { spawn } = require("node:child_process");',
    'const { rmSync } = require("node:fs");',
    `const parentPid = ${process.pid};`,
    `const serviceStatePath = ${JSON.stringify(managedServiceStateStore.path)};`,
    `const command = ${JSON.stringify(params.command ?? null)};`,
    `const args = ${JSON.stringify(params.args ?? [])};`,
    `const cwd = ${JSON.stringify(process.cwd())};`,
    "const env = process.env;",
    "function isRunning(pid) {",
    "  try {",
    "    process.kill(pid, 0);",
    "    return true;",
    "  } catch {",
    "    return false;",
    "  }",
    "}",
    "setTimeout(() => {",
    "  try {",
    "    process.kill(parentPid, 'SIGTERM');",
    "  } catch {}",
    "}, 150);",
    "const startedAt = Date.now();",
    "const maxWaitMs = 30000;",
    "const timer = setInterval(() => {",
    "  if (isRunning(parentPid)) {",
    "    if (Date.now() - startedAt > maxWaitMs) {",
    "      try {",
    "        process.kill(parentPid, 'SIGKILL');",
    "      } catch {}",
    "    }",
    "    return;",
    "  }",
    "  clearInterval(timer);",
    "  try {",
    "    rmSync(serviceStatePath, { force: true });",
    "  } catch {}",
    "  if (command) {",
    "    const child = spawn(command, args, { detached: true, stdio: 'ignore', cwd, env });",
    "    child.unref();",
    "  }",
    "  process.exit(0);",
    "}, 250);"
  ].join("");
  const helper = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: "ignore",
    env: process.env,
    cwd: process.cwd()
  });
  helper.unref();
}
