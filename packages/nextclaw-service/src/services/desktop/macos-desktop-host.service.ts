import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import type {
  DesktopHost,
  DesktopHostEventListener,
} from "@nextclaw/kernel";
import type {
  DesktopCapabilityError,
  DesktopHostCaller,
  DesktopHostEvent,
  DesktopHostMethod,
  DesktopHostStatus,
  ResolvedDesktopApplicationTarget,
} from "@nextclaw/kernel";
import { MacosAccessibilityService } from "@nextclaw-service/services/desktop/macos-accessibility.service.js";

const open = promisify(execFile);
// A full-resolution Vision OCR can legitimately take around ten seconds. Keep
// a bounded recovery path while leaving enough time for the 30-second REPL to
// compose multiple read/action/read steps.
const HOST_OPERATION_TIMEOUT_MS = 20_000;

const APPLICATIONS: Record<string, { bundleId: string }> = {
  finder: { bundleId: "com.apple.finder" },
  textedit: { bundleId: "com.apple.TextEdit" },
  activity_monitor: { bundleId: "com.apple.ActivityMonitor" },
  system_settings: { bundleId: "com.apple.systempreferences" },
  chrome: { bundleId: "com.google.Chrome" },
  wechat: { bundleId: "com.tencent.xinWeChat" },
};

type Watch = { stop: () => boolean };
type TargetLocator = { bundleId: string; pid: number; windowId: number };
type ResolvedExecutionTarget = TargetLocator & {
  window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
};

/** Synchronous macOS operations, owned by the service and run in its Worker. */
export class MacosDesktopHostOperations {
  private readonly accessibility: MacosAccessibilityService;
  private readonly watches = new Map<string, Watch>();
  private readonly eventListeners = new Set<DesktopHostEventListener>();

  constructor(options: {
    accessibility?: MacosAccessibilityService;
    openExternal?: (url: string) => Promise<void>;
  } = {}) {
    this.accessibility = options.accessibility ?? new MacosAccessibilityService();
    this.openExternal = options.openExternal ?? openSystemSettings;
  }

  private readonly openExternal: (url: string) => Promise<void>;

  status = async (): Promise<DesktopHostStatus> => ({
    online: true,
    platform: process.platform,
    protocolVersion: 1,
    supportedAccess: (this.accessibility.supported
      ? ["ui.read", "ui.observe", "ui.write", "input.pointer", "input.keyboard",
        ...(this.accessibility.getScreenCapturePermission() === "not_supported" ? [] : ["screen.capture-window"])]
      : []) as DesktopHostStatus["supportedAccess"],
    supportedOperations: (this.accessibility.supported
      ? ["host.status", "host.application.resolve", "host.permissions.get", "host.permissions.request",
        "host.permissions.openSettings", "host.ui.snapshot", "host.ui.observe", "host.ui.unobserve",
        "host.ui.action", "host.input.click", "host.input.typeText", "host.input.pressKey",
        ...(this.accessibility.getScreenCapturePermission() === "not_supported" ? [] : ["host.screen.captureWindow"])]
      : ["host.status"]) as DesktopHostStatus["supportedOperations"],
    permissions: this.permissions(),
  });

  invoke = async <T>(
    method: DesktopHostMethod,
    payload: Record<string, unknown>,
    _caller: DesktopHostCaller,
  ): Promise<T> => await this.invokeMethod(method, payload) as T;

  onEvent = (listener: DesktopHostEventListener): (() => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  dispose = async (): Promise<void> => {
    for (const watchId of [...this.watches.keys()]) this.unobserve(watchId);
    this.eventListeners.clear();
  };

  private invokeMethod = async (method: DesktopHostMethod, payload: Record<string, unknown>): Promise<unknown> => {
    if (method === "host.hello") return { protocolVersion: 1 };
    if (method === "host.status") return await this.status();
    if (method === "host.permissions.get") return this.permissions();
    if (method === "host.permissions.request") return {
      accessibility: this.accessibility.requestPermission(),
      screenCapture: this.accessibility.requestScreenCapturePermission(),
    };
    if (method === "host.permissions.openSettings") return await this.openSettings();
    if (method === "host.application.resolve") return this.resolveTarget(asRecord(payload.target));
    if (method === "host.ui.unobserve") return { stopped: this.unobserve(requiredString(payload.watchId, "watchId")) };

    const bundleId = requiredString(asRecord(payload.target).bundleId, "target.bundleId");
    const locator = readTargetLocator(payload.locator, bundleId);
    if (method === "host.ui.snapshot") return await this.snapshot(bundleId, payload, locator);
    if (method === "host.screen.captureWindow") return await this.captureWindow(bundleId, payload, locator);
    if (method === "host.ui.action") return await this.performAction(bundleId, payload, locator);
    if (method === "host.input.click") return await this.clickAt(bundleId, payload, locator);
    if (method === "host.input.typeText") return await this.typeText(bundleId, payload, locator);
    if (method === "host.input.pressKey") return await this.pressKey(bundleId, payload, locator);
    if (method === "host.ui.observe") return this.observe(bundleId, payload);
    throw hostError("operation_not_supported", `Desktop host method is not supported: ${method}`);
  };

  private permissions = () => ({
    accessibility: this.accessibility.getPermission(),
    screenCapture: this.accessibility.getScreenCapturePermission(),
  });

  private openSettings = async (): Promise<{ opened: true }> => {
    await this.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
    return { opened: true };
  };

  private resolveTarget = (target: Record<string, unknown>): ResolvedDesktopApplicationTarget => {
    const applicationId = requiredString(target.applicationId, "target.applicationId");
    if (process.platform !== "darwin") {
      throw hostError("unsupported_platform", `Desktop automation is not implemented for ${process.platform}.`);
    }
    const descriptor = APPLICATIONS[applicationId];
    if (!descriptor) throw hostError("operation_not_supported", `Desktop application is not registered: ${applicationId}`);
    this.accessibility.resolveApplication(descriptor.bundleId);
    return { platform: "darwin", applicationId, bundleId: descriptor.bundleId };
  };

  private snapshot = async (
    bundleId: string,
    payload: Record<string, unknown>,
    locator?: TargetLocator,
  ) => {
    const resolved = await this.resolveExecutionTarget(bundleId, locator);
    return {
      ...this.accessibility.snapshot(bundleId, { ...readSnapshotOptions(payload), pid: resolved.pid }),
      targetLocator: resolved,
    };
  };

  private captureWindow = async (
    bundleId: string,
    payload: Record<string, unknown>,
    locator?: TargetLocator,
  ) => {
    const detail = payload.detail === "low" || payload.detail === "high" ? payload.detail : undefined;
    const capture = await this.accessibility.captureApplicationWindow(bundleId, {
      ...(locator ? { pid: locator.pid } : {}),
      ...(detail ? { detail } : {}),
    });
    if (locator && capture.windowId !== locator.windowId) {
      throw hostError("stale_target", "The target window changed after the state was captured. Refresh state before acting.");
    }
    const resolved: ResolvedExecutionTarget = {
      bundleId,
      pid: capture.pid,
      windowId: capture.windowId,
      window: capture.window,
    };
    const ocrText = detail
      ? this.accessibility.recognizeText(capture.data, { detail })
      : this.accessibility.recognizeText(capture.data);
    return {
      target: resolved,
      window: resolved.window,
      ...(ocrText ? { ocrText } : {}),
      image: {
        type: "image",
        mimeType: capture.mimeType,
        data: capture.data,
        ...(capture.width && capture.height ? { width: capture.width, height: capture.height } : {}),
        ...(payload.detail === "low" || payload.detail === "high" ? { detail: payload.detail } : {}),
      },
    };
  };

  private performAction = async (bundleId: string, payload: Record<string, unknown>, locator?: TargetLocator) => {
    const resolved = await this.resolveExecutionTarget(bundleId, locator);
    const action = asRecord(payload.action);
    return this.accessibility.performAction(bundleId, {
      path: readPath(action.path),
      type: requiredString(action.type, "action.type") as "setValue" | "press" | "confirm",
      ...(typeof action.value === "string" ? { value: action.value } : {}),
      pid: resolved.pid,
      windowId: resolved.windowId,
    });
  };

  private clickAt = async (bundleId: string, payload: Record<string, unknown>, locator?: TargetLocator) => {
    const resolved = await this.resolveExecutionTarget(bundleId, locator);
    const coordinate = asRecord(payload.coordinate);
    const x = requiredFiniteNumber(coordinate.x, "coordinate.x");
    const y = requiredFiniteNumber(coordinate.y, "coordinate.y");
    const window = readCapturedWindow(payload.window);
    if (!contains(window, x, y)) throw hostError("operation_not_supported", "Pointer input must remain inside the captured target window.");
    return this.accessibility.clickAt(bundleId, { x, y, pid: resolved.pid, windowId: resolved.windowId });
  };

  private typeText = async (bundleId: string, payload: Record<string, unknown>, locator?: TargetLocator) => {
    const resolved = await this.resolveExecutionTarget(bundleId, locator);
    return this.accessibility.typeText(bundleId, {
      text: requiredString(payload.text, "text"),
      pid: resolved.pid,
      windowId: resolved.windowId,
    });
  };

  private pressKey = async (bundleId: string, payload: Record<string, unknown>, locator?: TargetLocator) => {
    const resolved = await this.resolveExecutionTarget(bundleId, locator);
    return this.accessibility.pressKey(bundleId, {
      key: requiredString(payload.key, "key"),
      ...(payload.modifiers === undefined ? {} : { modifiers: readKeyModifiers(payload.modifiers) }),
      pid: resolved.pid,
      windowId: resolved.windowId,
    });
  };

  private resolveExecutionTarget = async (bundleId: string, locator?: TargetLocator): Promise<ResolvedExecutionTarget> => {
    const resolved = locator
      ? await this.accessibility.resolveCaptureWindow(bundleId, { pid: locator.pid })
      : this.accessibility.resolveWindow(bundleId);
    if (locator && resolved.windowId !== locator.windowId) {
      throw hostError("stale_target", "The target window changed after the state was captured. Refresh state before acting.");
    }
    return { bundleId, pid: resolved.pid, windowId: resolved.windowId, window: resolved.window };
  };

  private observe = (bundleId: string, payload: Record<string, unknown>): { watchId: string } => {
    const watchId = randomUUID();
    const snapshotOptions = readSnapshotOptions(payload);
    const observer = this.accessibility.observe(bundleId, (nativeEvent) => {
      if (!this.watches.has(watchId)) return;
      const event: DesktopHostEvent = {
        protocolVersion: 1,
        type: "host.event",
        watchId,
        event: {
          type: "snapshotChanged",
          notification: nativeEvent.notification,
          snapshot: this.accessibility.snapshot(bundleId, snapshotOptions),
          occurredAt: new Date().toISOString(),
        },
      };
      for (const listener of this.eventListeners) listener(event);
    });
    this.watches.set(watchId, observer);
    return { watchId };
  };

  private unobserve = (watchId: string): boolean => {
    const watch = this.watches.get(watchId);
    if (!watch) return false;
    this.watches.delete(watchId);
    return watch.stop();
  };
}

type WorkerMessage =
  | { type: "result"; requestId: string; result: unknown }
  | { type: "error"; requestId: string; error: DesktopCapabilityError }
  | { type: "event"; event: DesktopHostEvent };

/**
 * Kernel-facing host. The Worker is an internal service thread, not a separate
 * process or daemon; it prevents synchronous AX calls from blocking 5174.
 */
export class MacosDesktopHostService implements DesktopHost {
  private worker: Worker | null = null;
  private readonly listeners = new Set<DesktopHostEventListener>();
  private readonly pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    worker: Worker;
  }>();

  status = async (): Promise<DesktopHostStatus> =>
    await this.invoke<DesktopHostStatus>("host.status", {}, {});

  invoke = async <T>(
    method: DesktopHostMethod,
    payload: Record<string, unknown>,
    caller: DesktopHostCaller,
  ): Promise<T> => await new Promise<T>((resolve, reject) => {
    const worker = this.requireWorker();
    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      const pending = this.pending.get(requestId);
      if (!pending) return;
      this.pending.delete(requestId);
      void this.resetWorker(pending.worker);
      reject(hostError("host_operation_failed", "Desktop operation timed out; the service recovered its local worker."));
    }, HOST_OPERATION_TIMEOUT_MS);
    timeout.unref?.();
    this.pending.set(requestId, { resolve: (value) => resolve(value as T), reject, timeout, worker });
    worker.postMessage({ type: "invoke", requestId, method, payload, caller });
  });

  onEvent = (listener: DesktopHostEventListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispose = async (): Promise<void> => await this.resetWorker();

  private requireWorker = (): Worker => {
    if (this.worker) return this.worker;
    const workerUrl = import.meta.url.endsWith(".ts")
      ? new URL("../../../dist/services/desktop/macos-desktop-host-worker.service.js", import.meta.url)
      : new URL("./macos-desktop-host-worker.service.js", import.meta.url);
    const worker = new Worker(workerUrl);
    worker.on("message", (message: WorkerMessage) => this.handleWorkerMessage(worker, message));
    worker.on("error", (error) => this.rejectPending(worker, error));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      if (code !== 0) this.rejectPending(worker, hostError("host_operation_failed", `Desktop worker exited unexpectedly (${code}).`));
    });
    this.worker = worker;
    return worker;
  };

  private handleWorkerMessage = (worker: Worker, message: WorkerMessage): void => {
    if (message.type === "event") {
      if (this.worker !== worker) return;
      for (const listener of this.listeners) listener(message.event);
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending || pending.worker !== worker) return;
    this.pending.delete(message.requestId);
    clearTimeout(pending.timeout);
    if (message.type === "result") pending.resolve(message.result);
    else pending.reject(Object.assign(new Error(message.error.message), message.error));
  };

  private resetWorker = async (worker = this.worker): Promise<void> => {
    if (!worker) return;
    if (this.worker === worker) this.worker = null;
    if (worker) await worker.terminate();
    this.rejectPending(worker, hostError("desktop_host_unavailable", "Desktop worker is unavailable."));
  };

  private rejectPending = (worker: Worker, error: Error): void => {
    for (const [requestId, pending] of this.pending) {
      if (pending.worker !== worker) continue;
      this.pending.delete(requestId);
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  };
}

async function openSystemSettings(url: string): Promise<void> {
  if (process.platform !== "darwin") throw hostError("unsupported_platform", "Opening Desktop settings is only supported on macOS.");
  await open("open", [url]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw hostError("host_operation_failed", `${field} is required.`);
  return value.trim();
}

function requiredFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw hostError("host_operation_failed", `${field} must be finite.`);
  return value;
}

function readKeyModifiers(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((modifier) => typeof modifier === "string")) {
    throw hostError("host_operation_failed", "modifiers must be an array of strings.");
  }
  return value;
}

function readPath(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item) && item >= 0)) {
    throw hostError("host_operation_failed", "action.path must contain non-negative integer indexes.");
  }
  return value as number[];
}

function readSnapshotOptions(payload: Record<string, unknown>): { maxDepth?: number; maxNodes?: number } {
  return {
    ...(Number.isInteger(payload.maxDepth) ? { maxDepth: payload.maxDepth as number } : {}),
    ...(Number.isInteger(payload.maxNodes) ? { maxNodes: payload.maxNodes as number } : {}),
  };
}

function readCapturedWindow(value: unknown): { position: { x: number; y: number }; size: { width: number; height: number } } {
  const window = asRecord(value);
  const position = asRecord(window.position);
  const size = asRecord(window.size);
  return {
    position: { x: requiredFiniteNumber(position.x, "window.position.x"), y: requiredFiniteNumber(position.y, "window.position.y") },
    size: { width: requiredFiniteNumber(size.width, "window.size.width"), height: requiredFiniteNumber(size.height, "window.size.height") },
  };
}

function contains(window: { position: { x: number; y: number }; size: { width: number; height: number } }, x: number, y: number): boolean {
  return x >= window.position.x && y >= window.position.y && x <= window.position.x + window.size.width && y <= window.position.y + window.size.height;
}

function hostError(code: DesktopCapabilityError["code"], message: string): Error {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}

function readTargetLocator(value: unknown, bundleId: string): TargetLocator | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const locator = value as Record<string, unknown>;
  if (locator.bundleId !== bundleId) return undefined;
  const pid = locator.pid;
  const windowId = locator.windowId;
  if (!isPositiveInteger(pid) || !isPositiveInteger(windowId)) return undefined;
  return { bundleId, pid, windowId };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
