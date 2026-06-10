import { getConfigPath, loadConfig } from "@nextclaw/core";
import type { RemoteServiceAction, RemoteServiceActionResult, RemoteServiceView } from "@nextclaw/server";
import { spawn } from "node:child_process";
import { resolveUiApiBase, resolveUiConfig } from "@nextclaw-service/utils/cli.utils.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import { ManagedServiceSupervisor } from "@nextclaw-service/services/runtime/managed-service-supervisor.service.js";

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
type ManagedServiceControlState = {
  currentProcess: boolean;
  recordedProcessExists: boolean;
  running: boolean;
};

class RemoteServiceControlService {
  private readonly managedServiceSupervisor = new ManagedServiceSupervisor();

  readonly resolveView = (currentUi?: CurrentUi): RemoteServiceView => {
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
    const liveness = this.managedServiceSupervisor.resolveStateLiveness(serviceState);
    const serviceRunning = Boolean(serviceState && liveness.running);
    return {
      running: serviceRunning,
      currentProcess: Boolean(serviceRunning && serviceState?.pid === process.pid),
      ...(serviceState?.pid ? { pid: serviceState.pid } : {}),
      ...(serviceState?.uiUrl ? { uiUrl: serviceState.uiUrl } : {}),
      ...(typeof serviceState?.uiPort === "number" ? { uiPort: serviceState.uiPort } : {})
    };
  };

  readonly control = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps
  ): Promise<RemoteServiceActionResult> => {
    if (deps.remoteRuntimeController) {
      return this.controlCurrentProcessRuntime(action, deps.remoteRuntimeController);
    }

    return this.controlManagedService(action, deps);
  };

  private readonly controlCurrentProcessRuntime = async (
    action: RemoteServiceAction,
    controller: RemoteRuntimeController
  ): Promise<RemoteServiceActionResult> => {
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
  };

  private readonly controlManagedService = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps
  ): Promise<RemoteServiceActionResult> => {
    const serviceState = this.resolveManagedServiceControlState();
    const uiOverrides = this.resolveManagedUiOverrides();

    if (action === "start") {
      return this.startManagedService(action, deps, serviceState, uiOverrides);
    }
    if (!serviceState.running) {
      return this.controlStoppedManagedService(action, deps, serviceState, uiOverrides);
    }
    if (serviceState.currentProcess) {
      return this.controlCurrentManagedProcess(action, deps, uiOverrides);
    }
    return this.controlExternalManagedProcess(action, deps, uiOverrides);
  };

  private readonly resolveManagedServiceControlState = (): ManagedServiceControlState => {
    const state = managedServiceStateStore.read();
    const liveness = this.managedServiceSupervisor.resolveStateLiveness(state);
    const running = Boolean(state && liveness.running);
    return {
      currentProcess: Boolean(running && state?.pid === process.pid),
      recordedProcessExists: Boolean(state && liveness.processExists),
      running
    };
  };

  private readonly startManagedService = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps,
    serviceState: ManagedServiceControlState,
    uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>
  ): Promise<RemoteServiceActionResult> => {
    if (serviceState.running) {
      return {
        accepted: true,
        action,
        message: serviceState.currentProcess ? "Managed service is already running for this UI." : "Managed service is already running."
      };
    }
    if (serviceState.recordedProcessExists) {
      return this.controlStaleManagedServiceProcess(action, deps, uiOverrides);
    }
    await deps.serviceCommands.startService({ uiOverrides, open: false });
    return { accepted: true, action, message: "Managed service started." };
  };

  private readonly controlStoppedManagedService = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps,
    serviceState: ManagedServiceControlState,
    uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>
  ): Promise<RemoteServiceActionResult> => {
    if (serviceState.recordedProcessExists) {
      return this.controlStaleManagedServiceProcess(action, deps, uiOverrides);
    }
    if (action === "restart") {
      await deps.serviceCommands.startService({ uiOverrides, open: false });
      return {
        accepted: true,
        action,
        message: "Managed service was not running and has been started."
      };
    }
    return { accepted: true, action, message: "No managed service is currently running." };
  };

  private readonly controlStaleManagedServiceProcess = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps,
    uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>
  ): Promise<RemoteServiceActionResult> => {
    if (action === "stop") {
      await deps.serviceCommands.stopService();
      return { accepted: true, action, message: "Stale managed service process stopped." };
    }
    if (action === "restart") {
      await deps.serviceCommands.stopService();
      await deps.serviceCommands.startService({ uiOverrides, open: false });
      return { accepted: true, action, message: "Stale managed service process replaced." };
    }
    await deps.serviceCommands.stopService();
    await deps.serviceCommands.startService({ uiOverrides, open: false });
    return { accepted: true, action, message: "Stale managed service process replaced." };
  };

  private readonly controlCurrentManagedProcess = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps,
    uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>
  ): Promise<RemoteServiceActionResult> => {
    if (action === "restart") {
      await deps.requestManagedServiceRestart({ uiPort: uiOverrides.port ?? 55667 });
    } else {
      launchManagedSelfControl();
    }
    return {
      accepted: true,
      action,
      message:
        action === "restart"
          ? "Restart scheduled. This page may disconnect for a few seconds."
          : "Stop scheduled. This page will disconnect shortly."
    };
  };

  private readonly controlExternalManagedProcess = async (
    action: RemoteServiceAction,
    deps: RemoteServiceControlDeps,
    uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>
  ): Promise<RemoteServiceActionResult> => {
    if (action === "stop") {
      await deps.serviceCommands.stopService();
      return { accepted: true, action, message: "Managed service stopped." };
    }

    await deps.serviceCommands.stopService();
    await deps.serviceCommands.startService({ uiOverrides, open: false });
    return { accepted: true, action, message: "Managed service restarted." };
  };

  private readonly resolveManagedUiOverrides = (): Partial<ReturnType<typeof resolveUiConfig>> => {
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
  };
}

const remoteServiceControlService = new RemoteServiceControlService();

export function resolveRemoteServiceView(currentUi?: CurrentUi): RemoteServiceView {
  return remoteServiceControlService.resolveView(currentUi);
}

export async function controlRemoteService(
  action: RemoteServiceAction,
  deps: RemoteServiceControlDeps
): Promise<RemoteServiceActionResult> {
  return remoteServiceControlService.control(action, deps);
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
