import type { ObservationManager } from "@kernel/features/observation/index.js";
import type {
  EventAdmissionPolicy,
  ObservationRef,
  SubscribeEventsInput,
} from "@kernel/features/observation/index.js";
import { normalizeToolParams } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

type ObservationToolContext = {
  sessionId: string;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function targetSessionId(
  params: Record<string, unknown>,
  context: ObservationToolContext,
): string {
  const currentSessionId = requiredString(
    context.sessionId,
    "current sessionId",
  );
  const requestedSessionId = optionalString(params.targetSessionId);
  if (requestedSessionId && requestedSessionId !== currentSessionId) {
    throw new Error("Cross-session observation tools are not supported.");
  }
  return currentSessionId;
}

function readObservationRef(value: unknown): ObservationRef {
  const record = optionalRecord(value);
  const kind = record?.kind;
  if (kind !== "context_binding" && kind !== "event_subscription") {
    throw new Error(
      "observation.kind must be context_binding or event_subscription.",
    );
  }
  return { kind, id: requiredString(record?.id, "observation.id") };
}

class BindContextTool implements NcpTool {
  readonly name = "bind_context";
  readonly description =
    "Persistently bind an Extension observation to this session. Its latest bounded snapshot is appended as untrusted data at the absolute end of every Native model input; it does not wake the agent.";
  readonly parameters: NcpTool["parameters"] = {
    type: "object",
    properties: {
      extensionId: { type: "string" },
      config: { type: "object", additionalProperties: true },
      targetSessionId: {
        type: "string",
        description: "Optional; currently must equal the current session.",
      },
      projection: {
        type: "object",
        properties: {
          maxChars: { type: "integer", minimum: 1, maximum: 20_000 },
          maxItems: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
      ttl: {
        type: "string",
        description: "ISO 8601 duration, for example P30D.",
      },
    },
    required: ["extensionId", "config"],
    additionalProperties: false,
  };

  constructor(
    private readonly manager: ObservationManager,
    private readonly context: ObservationToolContext,
  ) {}

  execute = async (args: unknown): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const projection = optionalRecord(params.projection);
    const binding = await this.manager.bindContext({
      extensionId: requiredString(params.extensionId, "extensionId"),
      config: structuredClone(params.config) as never,
      targetSessionId: targetSessionId(params, this.context),
      ...(projection
        ? {
            projection: {
              ...(typeof projection.maxChars === "number"
                ? { maxChars: projection.maxChars }
                : {}),
              ...(typeof projection.maxItems === "number"
                ? { maxItems: projection.maxItems }
                : {}),
            },
          }
        : {}),
      ...(optionalString(params.ttl)
        ? { ttl: optionalString(params.ttl) }
        : {}),
    });
    return { ok: true, ...binding };
  };
}

class SubscribeEventsTool implements NcpTool {
  readonly name = "subscribe_events";
  readonly description =
    "Persistently subscribe this Native session to a Extension event capability. Admitted events enter the standard agent input path and may start, queue, or steer at the next safe step.";
  readonly parameters: NcpTool["parameters"] = {
    type: "object",
    properties: {
      extensionId: { type: "string" },
      config: { type: "object", additionalProperties: true },
      targetSessionId: {
        type: "string",
        description: "Optional; currently must equal the current session.",
      },
      admission: {
        type: "object",
        description: "Optional typed predicate and dedupe policy.",
        properties: {
          predicate: {
            type: "object",
            description:
              "Typed predicate using exists/eq/ne/gt/gte/lt/lte/in/contains with path/value, or recursive and/or/not with args/arg.",
          },
          dedupe: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description:
                  "JSON Pointer into the event, for example /dedupeKey.",
              },
              window: { type: "string" },
            },
            required: ["key"],
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      delivery: { type: "string", enum: ["queue", "prefer-steer"] },
      budget: {
        type: "object",
        properties: {
          maxPending: { type: "integer", minimum: 1 },
          maxDeliveriesPerWindow: { type: "integer", minimum: 1 },
          window: { type: "string" },
        },
        additionalProperties: false,
      },
      ttl: {
        type: "string",
        description: "ISO 8601 duration, for example P30D.",
      },
    },
    required: ["extensionId", "config"],
    additionalProperties: false,
  };

  constructor(
    private readonly manager: ObservationManager,
    private readonly context: ObservationToolContext,
  ) {}

  execute = async (args: unknown): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const delivery = params.delivery;
    if (
      delivery !== undefined &&
      delivery !== "queue" &&
      delivery !== "prefer-steer"
    ) {
      throw new Error("delivery must be queue or prefer-steer.");
    }
    const budget = optionalRecord(params.budget);
    const input: SubscribeEventsInput = {
      extensionId: requiredString(params.extensionId, "extensionId"),
      config: structuredClone(params.config) as never,
      targetSessionId: targetSessionId(params, this.context),
      ...(optionalRecord(params.admission)
        ? {
            admission: structuredClone(
              params.admission,
            ) as EventAdmissionPolicy,
          }
        : {}),
      ...(delivery ? { delivery } : {}),
      ...(budget
        ? {
            budget: {
              ...(typeof budget.maxPending === "number"
                ? { maxPending: budget.maxPending }
                : {}),
              ...(typeof budget.maxDeliveriesPerWindow === "number"
                ? { maxDeliveriesPerWindow: budget.maxDeliveriesPerWindow }
                : {}),
              ...(optionalString(budget.window)
                ? { window: optionalString(budget.window) }
                : {}),
            },
          }
        : {}),
      ...(optionalString(params.ttl)
        ? { ttl: optionalString(params.ttl) }
        : {}),
    };
    const subscription = await this.manager.subscribeEvents(input);
    return { ok: true, ...subscription };
  };
}

class ManageObservationsTool implements NcpTool {
  readonly name = "manage_observations";
  readonly description =
    "Discover Extension context/event capabilities, list this session's persistent observations, or get, pause, resume, and remove one relationship.";
  readonly parameters: NcpTool["parameters"] = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["discover", "list", "get", "pause", "resume", "remove"],
      },
      observation: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["context_binding", "event_subscription"],
          },
          id: { type: "string" },
        },
        required: ["kind", "id"],
        additionalProperties: false,
      },
      query: { type: "string" },
      kinds: {
        type: "array",
        items: { type: "string", enum: ["context", "events"] },
      },
    },
    required: ["action"],
    additionalProperties: false,
  };

  constructor(
    private readonly manager: ObservationManager,
    private readonly context: ObservationToolContext,
  ) {}

  execute = async (args: unknown): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const action = requiredString(params.action, "action");
    if (action === "discover") {
      const kinds = Array.isArray(params.kinds)
        ? params.kinds.filter(
            (kind): kind is "context" | "events" =>
              kind === "context" || kind === "events",
          )
        : undefined;
      return {
        ok: true,
        sources: this.manager.discoverObservations({
          ...(optionalString(params.query)
            ? { query: optionalString(params.query) }
            : {}),
          ...(kinds ? { kinds } : {}),
        }),
      };
    }
    if (action === "list") {
      const result = await this.manager.listObservations(
        this.context.sessionId,
      );
      return {
        ok: true,
        bindings: result.bindings,
        subscriptions: result.subscriptions,
        deliveries: result.deliveries.map(
          ({ event: _event, ...delivery }) => delivery,
        ),
      };
    }
    if (
      action !== "get" &&
      action !== "pause" &&
      action !== "resume" &&
      action !== "remove"
    ) {
      throw new Error("Unsupported observation action.");
    }
    const observation = readObservationRef(params.observation);
    const current = await this.manager.getObservation(observation);
    if (current && current.target.sessionId !== this.context.sessionId) {
      throw new Error("Cross-session observation tools are not supported.");
    }
    if (action === "get") {
      return { ok: true, observation: current };
    }
    const result = await this.manager.updateObservation(action, observation);
    return { ok: true, ...result };
  };
}

export function createObservationTools(
  manager: ObservationManager,
  context: ObservationToolContext,
): readonly NcpTool[] {
  return [
    new BindContextTool(manager, context),
    new SubscribeEventsTool(manager, context),
    new ManageObservationsTool(manager, context),
  ];
}
