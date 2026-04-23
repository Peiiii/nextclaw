import type { Config } from "@nextclaw/core";
import type { NcpAgentRunInput, NcpEndpointEvent } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { PluginRegistry } from "@nextclaw/openclaw-compat";
import { fork, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ExtensionHostProxyRegistryService } from "@/cli/shared/services/extension-host-proxy-registry.service.js";
import type {
  ExtensionHostChannelOutboundRequest,
  ExtensionHostLoadProgress,
  ExtensionHostLoadRequest,
  ExtensionHostMessage,
  ExtensionHostRuntimeDescribeRequest,
  ExtensionHostRuntimeRunRequest,
  ExtensionHostSnapshot,
  ExtensionHostToolExecuteRequest,
} from "@/cli/shared/types/extension-host.types.js";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type RuntimeStreamState = {
  queue: Array<NcpEndpointEvent | Error | null>;
  wake: (() => void) | null;
  onMetadata: (metadata: Record<string, unknown>) => void;
  applyStateBatch: (events: NcpEndpointEvent[]) => Promise<void>;
};

function resolveChildEntryPath(): string {
  const sourcePath = fileURLToPath(new URL("./extension-host-child.service.ts", import.meta.url));
  if (existsSync(sourcePath)) {
    return sourcePath;
  }
  return fileURLToPath(new URL("./extension-host-child.service.js", import.meta.url));
}

export class ExtensionHostClient {
  private child: ChildProcess | null = null;
  private nextRequestId = 1;
  private nextStreamId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly runtimeStreams = new Map<string, RuntimeStreamState>();
  private readonly proxyRegistry = new ExtensionHostProxyRegistryService(this);

  constructor(
    private readonly params: {
      onProgress?: (progress: ExtensionHostLoadProgress) => void;
    } = {},
  ) {}

  load = async (request: ExtensionHostLoadRequest): Promise<ExtensionHostSnapshot> =>
    await this.request<ExtensionHostSnapshot>("load", request);

  startPluginGateways = async (config: Config): Promise<void> => {
    await this.request("channel.startGateways", { config });
  };

  stopPluginGateways = async (): Promise<void> => {
    await this.request("channel.stopGateways", undefined);
  };

  executeTool = async (request: ExtensionHostToolExecuteRequest): Promise<unknown> =>
    await this.request("tool.execute", request);

  sendChannelOutbound = async (request: ExtensionHostChannelOutboundRequest): Promise<unknown> =>
    await this.request("channel.outbound", request);

  describeRuntime = async (request: ExtensionHostRuntimeDescribeRequest): Promise<unknown> =>
    await this.request("runtime.describe", request);

  createProxyPluginRegistry = (snapshot: ExtensionHostSnapshot): PluginRegistry =>
    this.proxyRegistry.createPluginRegistry(snapshot);

  runRuntimeStream = async function* (
    this: ExtensionHostClient,
    params: {
      kind: string;
      entry?: ExtensionHostRuntimeDescribeRequest["entry"];
      runtimeParams: RuntimeFactoryParams;
      input: NcpAgentRunInput;
      signal?: AbortSignal;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { entry, input, kind, runtimeParams, signal } = params;
    const streamId = `runtime-${this.nextStreamId++}`;
    const state: RuntimeStreamState = {
      queue: [],
      wake: null,
      onMetadata: runtimeParams.setSessionMetadata,
      applyStateBatch: async (events) => {
        await runtimeParams.stateManager.dispatchBatch(events);
      },
    };
    this.runtimeStreams.set(streamId, state);
    const abortListener = () => {
      void this.request("runtime.abort", {
        streamId,
        reason: typeof signal?.reason === "string" ? signal.reason : undefined,
      }).catch(() => undefined);
    };
    signal?.addEventListener("abort", abortListener, { once: true });
    await this.request("runtime.run", {
      streamId,
      kind,
      entry,
      runtimeParams: {
        sessionId: runtimeParams.sessionId,
        agentId: runtimeParams.agentId,
        sessionMetadata: runtimeParams.sessionMetadata,
        ...(runtimeParams.resolveTools
          ? { resolvedTools: Array.from(runtimeParams.resolveTools(input) ?? []) }
          : {}),
      },
      input,
    } satisfies ExtensionHostRuntimeRunRequest);

    try {
      while (true) {
        const next = await this.nextRuntimeStreamItem(state);
        if (next === null) {
          return;
        }
        if (next instanceof Error) {
          throw next;
        }
        yield next;
      }
    } finally {
      signal?.removeEventListener("abort", abortListener);
      this.runtimeStreams.delete(streamId);
    }
  };

  dispose = async (): Promise<void> => {
    await this.stopPluginGateways().catch(() => undefined);
    this.child?.kill();
    this.child = null;
    this.rejectAll(new Error("Extension host disposed"));
  };

  private request = async <T = unknown>(
    method: Extract<ExtensionHostMessage, { type: "request" }>["method"],
    payload: Extract<ExtensionHostMessage, { type: "request" }>["payload"],
  ): Promise<T> => {
    const child = this.ensureChild();
    const id = this.nextRequestId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
    child.send?.({ type: "request", id, method, payload } as ExtensionHostMessage);
    return await promise;
  };

  private ensureChild = (): ChildProcess => {
    if (this.child) {
      return this.child;
    }
    const child = fork(resolveChildEntryPath(), [], {
      env: process.env,
      execArgv: process.execArgv,
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    child.on("message", (message) => this.handleMessage(message as ExtensionHostMessage));
    child.on("exit", (code, signal) => {
      this.child = null;
      this.rejectAll(new Error(`Extension host exited: code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
    child.on("error", (error) => {
      this.rejectAll(error);
    });
    this.child = child;
    return child;
  };

  private handleMessage = (message: ExtensionHostMessage): void => {
    if (message.type === "response") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.ok) {
        pending.resolve(message.payload);
        return;
      }
      pending.reject(new Error(message.error));
      return;
    }
    if (message.type !== "event") {
      return;
    }
    if (message.event === "load.progress") {
      this.params.onProgress?.(message.payload);
      return;
    }
    if (message.event === "runtime.state.dispatchBatch") {
      this.runtimeStreams.get(message.payload.streamId)?.applyStateBatch(message.payload.events);
      return;
    }
    const state = this.runtimeStreams.get(message.payload.streamId);
    if (!state) {
      return;
    }
    if (message.event === "runtime.event") {
      this.pushRuntimeStreamItem(state, message.payload.event);
      return;
    }
    if (message.event === "runtime.metadata") {
      state.onMetadata(message.payload.metadata);
      return;
    }
    if (message.event === "runtime.error") {
      this.pushRuntimeStreamItem(state, new Error(message.payload.error));
      return;
    }
    if (message.event === "runtime.done") {
      this.pushRuntimeStreamItem(state, null);
    }
  };

  private pushRuntimeStreamItem = (
    state: RuntimeStreamState,
    item: NcpEndpointEvent | Error | null,
  ): void => {
    state.queue.push(item);
    state.wake?.();
    state.wake = null;
  };

  private nextRuntimeStreamItem = async (
    state: RuntimeStreamState,
  ): Promise<NcpEndpointEvent | Error | null> => {
    const queued = state.queue.shift();
    if (queued !== undefined) {
      return queued;
    }
    await new Promise<void>((resolve) => {
      state.wake = resolve;
    });
    return state.queue.shift() ?? null;
  };

  private rejectAll = (error: Error): void => {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    for (const state of this.runtimeStreams.values()) {
      this.pushRuntimeStreamItem(state, error);
    }
  };
}
