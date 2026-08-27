import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { DesktopSessionCaller, DesktopSessionStateService } from "@kernel/features/desktop-host/index.js";

const MAX_CODE_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
// Align the controlled desktop program with Codex's standard Node REPL budget:
// one task may need screenshot OCR, an action, then a fresh read.
const EXECUTION_TIMEOUT_MS = 30_000;
const IDLE_TIMEOUT_MS = 2 * 60_000;

type PendingExecution = {
  caller: DesktopSessionCaller;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  removeAbortListener?: () => void;
};

type SessionWorker = {
  child: ChildProcess;
  pending: Map<string, PendingExecution>;
  busy: boolean;
  idleTimeout?: NodeJS.Timeout;
};

/**
 * Codex-style code entry point: a session-scoped REPL worker receives a small
 * desktop SDK and no host Node.js capabilities. The SDK still delegates every
 * operation to the normal state, grant, and audit owners.
 */
export class DesktopNodeReplService {
  private readonly workers = new Map<string, SessionWorker>();

  constructor(private readonly sessionState: DesktopSessionStateService) {}

  execute = async (input: DesktopSessionCaller & { code: unknown; signal?: AbortSignal }): Promise<unknown> => {
    const code = readCode(input.code);
    const key = sessionKey(input);
    const worker = this.getOrCreateWorker(key);
    if (worker.busy) throw replError("repl_busy", "The session node_repl is already executing code.");
    worker.busy = true;
    clearTimeout(worker.idleTimeout);
    const executionId = randomUUID();
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.reject(worker, executionId, replError("repl_timeout", "node_repl exceeded its 30 second time limit."));
          this.stopWorker(key, worker);
        }, EXECUTION_TIMEOUT_MS);
        timeout.unref?.();
        const pending: PendingExecution = {
          caller: pickCaller(input),
          resolve,
          reject,
          timeout,
        };
        const abort = () => {
          this.reject(worker, executionId, replError("repl_cancelled", "node_repl was cancelled."));
          this.stopWorker(key, worker);
        };
        input.signal?.addEventListener("abort", abort, { once: true });
        pending.removeAbortListener = () => input.signal?.removeEventListener("abort", abort);
        worker.pending.set(executionId, pending);
        worker.child.send({ type: "execute", executionId, code }, (error) => {
          if (error) this.reject(worker, executionId, replError("repl_unavailable", `node_repl worker is unavailable: ${error.message}`));
        });
      });
    } finally {
      worker.busy = false;
      this.scheduleIdleStop(key, worker);
    }
  };

  dispose = (): void => {
    for (const [key, worker] of this.workers) this.stopWorker(key, worker);
  };

  private getOrCreateWorker(key: string): SessionWorker {
    const existing = this.workers.get(key);
    if (existing && !existing.child.killed) return existing;
    const child = spawn(process.execPath, ["--experimental-permission", "--eval", WORKER_SOURCE], {
      // Electron runs the same script as a Node process without exposing Electron APIs.
      env: { ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    });
    const worker: SessionWorker = { child, pending: new Map(), busy: false };
    child.on("message", (message) => void this.handleWorkerMessage(key, worker, message));
    child.once("exit", () => this.stopWorker(key, worker));
    child.once("error", () => this.stopWorker(key, worker));
    this.workers.set(key, worker);
    return worker;
  }

  private async handleWorkerMessage(key: string, worker: SessionWorker, value: unknown): Promise<void> {
    const message = asRecord(value);
    const executionId = readString(message.executionId);
    if (!executionId || !worker.pending.has(executionId)) return;
    if (message.type === "desktop.request") {
      const requestId = readString(message.requestId);
      if (!requestId) return;
      try {
        const result = await this.invokeDesktop(worker.pending.get(executionId)!.caller, message.operation, message.args);
        worker.child.send({ type: "desktop.response", executionId, requestId, ok: true, result });
      } catch (error) {
        worker.child.send({ type: "desktop.response", executionId, requestId, ok: false, error: workerError(error) });
      }
      return;
    }
    if (message.type === "result") {
      this.resolve(worker, executionId, {
        outputs: trimOutput(message.outputs),
        ...(message.value === undefined ? {} : { value: trimOutput(message.value) }),
      });
      return;
    }
    if (message.type === "error") {
      const error = asRecord(message.error);
      this.reject(worker, executionId, replError(readString(error.code) ?? "repl_execution_failed", readString(error.message) ?? "node_repl execution failed."));
      return;
    }
    this.stopWorker(key, worker);
  }

  private async invokeDesktop(caller: DesktopSessionCaller, operation: unknown, rawArgs: unknown): Promise<unknown> {
    const args = asRecord(rawArgs);
    const target = readTarget(args.target);
    switch (operation) {
      case "getAppState":
        return await this.sessionState.snapshot(caller, {
          target,
          ...(args.source === "screen" || args.source === "both" ? { source: args.source } : {}),
          ...(args.detail === "low" || args.detail === "high" ? { detail: args.detail } : {}),
          ...(isBoundedInteger(args.maxDepth, 1, 32) ? { maxDepth: args.maxDepth } : {}),
          ...(isBoundedInteger(args.maxNodes, 1, 20_000) ? { maxNodes: args.maxNodes } : {}),
        });
      case "setValue":
        return await this.sessionState.setValue(caller, {
          target,
          stateId: requiredString(args.stateId, "stateId"),
          elementIndex: readElementIndex(args.element),
          value: requiredValue(args.value ?? args.text, "value"),
        });
      case "click":
        return await this.sessionState.click(caller, {
          target,
          stateId: requiredString(args.stateId, "stateId"),
          ...(args.coordinate === undefined ? { elementIndex: readElementIndex(args.element) } : { coordinate: readCoordinate(args.coordinate) }),
        });
      case "typeText":
        return await this.sessionState.typeText(caller, {
          target,
          stateId: requiredString(args.stateId, "stateId"),
          text: requiredText(args.text, "text"),
        });
      case "pressKey":
        return await this.sessionState.pressKey(caller, {
          target,
          stateId: requiredString(args.stateId, "stateId"),
          key: readKeyboardKey(args.key),
          ...(args.modifiers === undefined ? {} : { modifiers: readKeyboardModifiers(args.modifiers) }),
        });
      default:
        throw replError("operation_not_supported", `desktop.${String(operation)} is not supported.`);
    }
  }

  private resolve(worker: SessionWorker, executionId: string, value: unknown): void {
    const pending = worker.pending.get(executionId);
    if (!pending) return;
    worker.pending.delete(executionId);
    clearTimeout(pending.timeout);
    pending.removeAbortListener?.();
    pending.resolve(value);
  }

  private reject(worker: SessionWorker, executionId: string, error: Error): void {
    const pending = worker.pending.get(executionId);
    if (!pending) return;
    worker.pending.delete(executionId);
    clearTimeout(pending.timeout);
    pending.removeAbortListener?.();
    pending.reject(error);
  }

  private scheduleIdleStop(key: string, worker: SessionWorker): void {
    worker.idleTimeout = setTimeout(() => this.stopWorker(key, worker), IDLE_TIMEOUT_MS);
    worker.idleTimeout.unref?.();
  }

  private stopWorker(key: string, worker: SessionWorker): void {
    if (this.workers.get(key) === worker) this.workers.delete(key);
    clearTimeout(worker.idleTimeout);
    for (const [executionId] of worker.pending) this.reject(worker, executionId, replError("repl_unavailable", "node_repl worker stopped."));
    if (!worker.child.killed) worker.child.kill();
  }
}

function readCode(value: unknown): string {
  const code = requiredText(value, "code");
  if (Buffer.byteLength(code) > MAX_CODE_BYTES) throw replError("payload_limit_exceeded", "node_repl code exceeds 32 KiB.");
  return code;
}

function pickCaller(input: DesktopSessionCaller): DesktopSessionCaller {
  return { agentId: input.agentId, sessionId: input.sessionId, ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}) };
}

function readTarget(value: unknown): { applicationId: string } {
  return { applicationId: requiredString(asRecord(value).applicationId, "target.applicationId") };
}

function readElementIndex(value: unknown): number {
  const index = asRecord(value).index;
  if (!isBoundedInteger(index, 0, Number.MAX_SAFE_INTEGER)) throw replError("element_not_found", "element.index must be a non-negative integer.");
  return index;
}

function readCoordinate(value: unknown): { x: number; y: number } {
  const coordinate = asRecord(value);
  if (!isFiniteNumber(coordinate.x) || !isFiniteNumber(coordinate.y)) {
    throw replError("invalid_tool_arguments", "coordinate.x and coordinate.y must be finite numbers.");
  }
  return { x: coordinate.x, y: coordinate.y };
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw replError("invalid_tool_arguments", `${field} must be a non-empty string.`);
  return value.trim();
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw replError("invalid_tool_arguments", `${field} must be a non-empty string.`);
  return value;
}

function requiredValue(value: unknown, field: string): string {
  if (typeof value !== "string") throw replError("invalid_tool_arguments", `${field} must be a string.`);
  return value;
}

const SUPPORTED_KEYS = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789",
  "Enter", "Escape", "Tab", "Space", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);
const SUPPORTED_KEY_MODIFIERS = new Set(["command", "control", "option", "shift"]);

function readKeyboardKey(value: unknown): string {
  const key = requiredString(value, "key");
  if (!SUPPORTED_KEYS.has(key)) {
    throw replError("invalid_tool_arguments", "key must be a supported named key or a lowercase letter/digit.");
  }
  return key;
}

function readKeyboardModifiers(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((modifier) => typeof modifier === "string" && SUPPORTED_KEY_MODIFIERS.has(modifier))) {
    throw replError("invalid_tool_arguments", "modifiers must contain only command, control, option, or shift.");
  }
  if (new Set(value).size !== value.length) {
    throw replError("invalid_tool_arguments", "modifiers cannot contain duplicates.");
  }
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function trimOutput(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value ?? null);
    return Buffer.byteLength(serialized) <= MAX_OUTPUT_BYTES ? JSON.parse(serialized) as unknown : "[output omitted: exceeds 512 KiB]";
  } catch {
    return "[unserializable output]";
  }
}

function workerError(error: unknown): { code: string; message: string } {
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record?.code === "string" ? record.code : "desktop_operation_failed",
    message: typeof record?.message === "string" ? record.message : String(error),
  };
}

function sessionKey(caller: DesktopSessionCaller): string {
  return `${caller.agentId}:${caller.sessionId}`;
}

function replError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

const WORKER_SOURCE = String.raw`
const vm = require("node:vm");
const pending = new Map();
const outputs = [];
let activeExecutionId = null;
let requestCount = 0;
const send = (value) => process.send && process.send(value);
const desktop = Object.freeze(Object.fromEntries(["getAppState", "setValue", "click", "typeText", "pressKey"].map((operation) => [operation, (args) => new Promise((resolve, reject) => {
  const requestId = String(++requestCount);
  pending.set(requestId, { resolve, reject });
  send({ type: "desktop.request", executionId: activeExecutionId, requestId, operation, args });
})])));
const repl = Object.freeze({ state: Object.create(null), write: (value) => outputs.push(value) });
const sandbox = Object.create(null);
Object.assign(sandbox, { desktop, repl });
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox, { name: "nextclaw-desktop-node-repl" });
process.on("message", async (message) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "desktop.response") {
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    if (message.ok) request.resolve(message.result);
    else request.reject(Object.assign(new Error(message.error && message.error.message || "Desktop operation failed."), message.error || {}));
    return;
  }
  if (message.type !== "execute" || typeof message.code !== "string" || activeExecutionId) return;
  activeExecutionId = message.executionId;
  outputs.length = 0;
  try {
    const script = new vm.Script("(async () => {\n" + message.code + "\n})()", { filename: "nextclaw-desktop-node-repl.js" });
    const value = await script.runInContext(context, { timeout: 2_000 });
    send({ type: "result", executionId: activeExecutionId, outputs, value });
  } catch (error) {
    send({ type: "error", executionId: activeExecutionId, error: { code: error && error.code, message: error && error.message || String(error) } });
  } finally {
    activeExecutionId = null;
  }
});
`;
