import { randomUUID } from "node:crypto";
import type { ObservationStore } from "@kernel/features/observation/stores/observation.store.js";
import type {
  BindContextInput,
  BuildContextTailInput,
  ContextBinding,
  JsonValue,
  ObservationContextTail,
  ObservationExtensionRuntime,
} from "@kernel/features/observation/types/observation.types.js";
import {
  parseObservationDuration,
  toBoundedJson,
} from "@kernel/features/observation/utils/observation.utils.js";

const DEFAULT_CONTEXT_MAX_CHARS = 4_000;
const MAX_CONTEXT_BINDING_CHARS = 20_000;
const MAX_CONTEXT_TAIL_CHARS = 12_000;
const CONTEXT_READ_TIMEOUT_MS = 5_000;
const DEFAULT_RELATIONSHIP_TTL = "P30D";

export type ObservationContextServiceOptions = {
  store: ObservationStore;
  getRuntime: () => ObservationExtensionRuntime;
  resolveTarget: (
    sessionId: string,
  ) => Promise<{ sessionId: string; agentId: string }>;
  now?: () => Date;
};

export class ObservationContextService {
  constructor(private readonly options: ObservationContextServiceOptions) {}

  bind = async (input: BindContextInput): Promise<ContextBinding> => {
    const extensionId = this.requireString(input.extensionId, "extensionId");
    const target = await this.options.resolveTarget(input.targetSessionId);
    this.assertProjection(input.projection);
    const expiresAt = new Date(
      this.nowMs() +
        parseObservationDuration(input.ttl ?? DEFAULT_RELATIONSHIP_TTL, "ttl"),
    ).toISOString();
    return await this.options.store.mutate((state) => {
      const existing = state.bindings.find(
        (item) =>
          item.extensionId === extensionId &&
          JSON.stringify(item.config) === JSON.stringify(input.config) &&
          item.target.sessionId === target.sessionId &&
          item.status !== "expired",
      );
      if (existing) return structuredClone(existing);
      const binding: ContextBinding = {
        bindingId: `context-binding-${randomUUID()}`,
        extensionId,
        config: structuredClone(input.config),
        target,
        projection: {
          ...(input.projection?.maxChars
            ? { maxChars: input.projection.maxChars }
            : {}),
          ...(input.projection?.maxItems
            ? { maxItems: input.projection.maxItems }
            : {}),
        },
        status: "active",
        createdAt: this.now().toISOString(),
        expiresAt,
      };
      state.bindings.push(binding);
      return structuredClone(binding);
    });
  };

  buildTail = async (
    input: BuildContextTailInput,
  ): Promise<ObservationContextTail | undefined> => {
    await this.expire();
    const bindings = (await this.options.store.read()).bindings
      .filter(
        (item) =>
          item.target.sessionId === input.sessionId &&
          (item.status === "active" || item.status === "degraded"),
      )
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.bindingId.localeCompare(right.bindingId),
      );
    if (bindings.length === 0) return undefined;
    const results = await Promise.all(
      bindings.map((binding) => this.readBinding(binding, input.signal)),
    );
    const readAt = this.now().toISOString();
    await this.options.store.mutate((state) => {
      for (const result of results) {
        const binding = state.bindings.find(
          (item) => item.bindingId === result.binding.bindingId,
        );
        if (
          !binding ||
          binding.status === "paused" ||
          binding.status === "expired"
        )
          continue;
        binding.lastReadAt = readAt;
        binding.status = result.status;
        if (result.reason) binding.statusReason = result.reason;
        else delete binding.statusReason;
      }
    });
    let remainingChars = MAX_CONTEXT_TAIL_CHARS;
    return {
      kind: "context_tail",
      entries: results.map(({ entry }) => {
        const payload = toBoundedJson(
          entry.payload,
          Math.max(256, remainingChars),
        );
        remainingChars = Math.max(
          0,
          remainingChars - JSON.stringify(payload).length,
        );
        return { ...entry, payload };
      }),
    };
  };

  get = async (bindingId: string): Promise<ContextBinding | null> => {
    const item = (await this.options.store.read()).bindings.find(
      (binding) => binding.bindingId === bindingId,
    );
    return item ? structuredClone(item) : null;
  };

  update = async (
    action: "pause" | "resume" | "remove",
    bindingId: string,
  ): Promise<ContextBinding | null> =>
    await this.options.store.mutate((state) => {
      const index = state.bindings.findIndex(
        (item) => item.bindingId === bindingId,
      );
      if (index < 0) return null;
      if (action === "remove") {
        state.bindings.splice(index, 1);
        return null;
      }
      const item = state.bindings[index];
      item.status = action === "pause" ? "paused" : "active";
      delete item.statusReason;
      return structuredClone(item);
    });

  reconcile = async (): Promise<void> => {
    await this.expire();
    await this.options.store.mutate(async (state) => {
      for (const binding of state.bindings) {
        if (binding.status === "paused" || binding.status === "expired")
          continue;
        try {
          await this.assertStoredTarget(binding);
          if (binding.status === "broken") {
            binding.status = "active";
            delete binding.statusReason;
          }
        } catch (error) {
          binding.status = "broken";
          binding.statusReason = this.errorMessage(error, "target_invalid");
        }
      }
    });
  };

  revalidateSession = async (sessionId: string): Promise<void> =>
    await this.reconcileSession(sessionId);

  removeSession = async (sessionId: string): Promise<void> => {
    await this.options.store.mutate((state) => {
      state.bindings = state.bindings.filter(
        (binding) => binding.target.sessionId !== sessionId,
      );
    });
  };

  expire = async (): Promise<void> => {
    const state = await this.options.store.read();
    if (
      !state.bindings.some(
        (item) =>
          item.expiresAt &&
          Date.parse(item.expiresAt) <= this.nowMs() &&
          item.status !== "expired",
      )
    )
      return;
    await this.options.store.mutate((current) => {
      for (const binding of current.bindings)
        if (binding.expiresAt && Date.parse(binding.expiresAt) <= this.nowMs())
          binding.status = "expired";
    });
  };

  private readBinding = async (
    binding: ContextBinding,
    signal?: AbortSignal,
  ): Promise<{
    binding: ContextBinding;
    entry: ObservationContextTail["entries"][number];
    status: ContextBinding["status"];
    reason?: string;
  }> => {
    const controller = this.createReadController(signal);
    try {
      const payload = await this.options.getRuntime().readObservation({
        extensionId: binding.extensionId,
        config: binding.config,
        signal: controller.signal,
      });
      return {
        binding,
        entry: {
          bindingId: binding.bindingId,
          extensionId: binding.extensionId,
          snapshotId: `${binding.bindingId}:${this.now().toISOString()}`,
          freshness: "fresh",
          observedAt: this.now().toISOString(),
          payload: toBoundedJson(
            payload,
            binding.projection.maxChars ?? DEFAULT_CONTEXT_MAX_CHARS,
          ),
        },
        status: "active",
      };
    } catch (error) {
      return {
        binding,
        entry: {
          bindingId: binding.bindingId,
          extensionId: binding.extensionId,
          freshness: "unavailable",
          observedAt: this.now().toISOString(),
          payload: {
            reason: controller.signal.aborted
              ? "timeout"
              : "temporarily_unavailable",
          } satisfies JsonValue,
        },
        status: "degraded",
        reason: this.errorMessage(error, "context_read_failed"),
      };
    } finally {
      controller.dispose();
    }
  };

  private reconcileSession = async (sessionId: string): Promise<void> => {
    const bindings = (await this.options.store.read()).bindings.filter(
      (item) =>
        item.target.sessionId === sessionId &&
        item.status !== "paused" &&
        item.status !== "expired",
    );
    try {
      const target = await this.options.resolveTarget(sessionId);
      if (bindings.some((item) => item.target.agentId !== target.agentId))
        throw new Error("target_agent_changed");
    } catch (error) {
      await this.options.store.mutate((state) => {
        for (const item of state.bindings)
          if (
            item.target.sessionId === sessionId &&
            item.status !== "paused" &&
            item.status !== "expired"
          ) {
            item.status = "broken";
            item.statusReason = this.errorMessage(error, "target_invalid");
          }
      });
    }
  };

  private assertStoredTarget = async (
    binding: ContextBinding,
  ): Promise<void> => {
    const target = await this.options.resolveTarget(binding.target.sessionId);
    if (target.agentId !== binding.target.agentId)
      throw new Error("target_agent_changed");
  };
  private assertProjection = (
    projection: BindContextInput["projection"],
  ): void => {
    if (
      projection?.maxChars !== undefined &&
      (!Number.isInteger(projection.maxChars) ||
        projection.maxChars <= 0 ||
        projection.maxChars > MAX_CONTEXT_BINDING_CHARS)
    )
      throw new Error(
        `projection.maxChars must be between 1 and ${MAX_CONTEXT_BINDING_CHARS}.`,
      );
    if (
      projection?.maxItems !== undefined &&
      (!Number.isInteger(projection.maxItems) || projection.maxItems <= 0)
    )
      throw new Error("projection.maxItems must be a positive integer.");
  };
  private createReadController = (
    parent?: AbortSignal,
  ): AbortController & { dispose(): void } => {
    const controller = new AbortController() as AbortController & {
      dispose(): void;
    };
    const abort = (): void => controller.abort(parent?.reason);
    if (parent?.aborted) abort();
    else parent?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(
      () => controller.abort("context_read_timeout"),
      CONTEXT_READ_TIMEOUT_MS,
    );
    controller.dispose = () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    };
    return controller;
  };
  private requireString = (value: string, field: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${field} must be a non-empty string.`);
    return normalized;
  };
  private errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback;
  private now = (): Date => this.options.now?.() ?? new Date();
  private nowMs = (): number => this.now().getTime();
}
