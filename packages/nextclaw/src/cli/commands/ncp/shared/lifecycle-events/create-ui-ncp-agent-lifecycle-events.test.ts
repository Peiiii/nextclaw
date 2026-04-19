import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigSchema,
  createGlobalTypedEventBus,
  MessageBus,
  SessionManager,
  type LLMStreamEvent,
  type ProviderManager,
} from "@nextclaw/core";
import { type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import { createUiNcpAgent } from "../../features/runtime/create-ui-ncp-agent.service.js";
import { agentRunFinishedLifecycleEventKey } from "./index.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-lifecycle-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

class RecordingProviderManager {
  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }

  async *chatStream(): AsyncGenerator<LLMStreamEvent> {
    yield {
      type: "done",
      response: {
        content: "final answer",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  }
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
}): NcpRequestEnvelope {
  const { sessionId, text } = params;
  return {
    sessionId,
    message: {
      id: `${sessionId}:user:${Date.now()}`,
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text }],
    },
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });
  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}

describe("createUiNcpAgent lifecycle events", () => {
  it("publishes lifecycle events to the global typed event bus", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
    });
    const eventBus = createGlobalTypedEventBus();
    const listener = vi.fn();
    eventBus.on(agentRunFinishedLifecycleEventKey, listener);
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      globalEventBus: eventBus,
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });

    try {
      await sendAndCollectEvents(
        ncpAgent.agentClientEndpoint,
        createEnvelope({
          sessionId: "session-lifecycle",
          text: "please inspect the workspace",
        }),
      );
    } finally {
      await ncpAgent.dispose?.();
    }

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-lifecycle",
        isChildSession: false,
      }),
    );
  }, 15000);
});
