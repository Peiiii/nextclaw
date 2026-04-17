#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

class EchoAgent {
  constructor(connection) {
    this.connection = connection;
    this.sessions = new Map();
  }

  async initialize() {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    };
  }

  async newSession() {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      modelId: null,
      abortController: null,
    });
    return { sessionId };
  }

  async authenticate() {
    return {};
  }

  async setSessionMode() {
    return {};
  }

  async unstable_setSessionModel(params) {
    const session = this.sessions.get(params.sessionId);
    if (session) {
      session.modelId = params.modelId;
    }
    return {};
  }

  async prompt(params) {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    const abortController = new AbortController();
    session.abortController = abortController;

    const meta = params._meta?.nextclaw_narp ?? {};
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: {
          type: "text",
          text: "reasoning via ACP",
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "call-1",
        title: "emit_meta",
        kind: "execute",
        status: "pending",
        rawInput: {
          requested: true,
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "call-1",
        status: "completed",
        rawOutput: {
          modelId: session.modelId,
          routedModel: meta.providerRoute?.model ?? null,
          envRoutedModel: process.env.NEXTCLAW_MODEL ?? null,
          headerKeys: Object.keys(meta.providerRoute?.headers ?? {}),
          envHeaderKeys: (() => {
            try {
              const parsed = JSON.parse(process.env.NEXTCLAW_HEADERS_JSON ?? "{}");
              return typeof parsed === "object" && parsed && !Array.isArray(parsed)
                ? Object.keys(parsed)
                : [];
            } catch {
              return [];
            }
          })(),
          toolNames: Array.isArray(meta.tools)
            ? meta.tools.map((tool) => tool?.function?.name).filter(Boolean)
            : [],
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "pong via ACP",
        },
      },
    });
    return {
      stopReason: abortController.signal.aborted ? "cancelled" : "end_turn",
    };
  }

  async cancel(params) {
    this.sessions.get(params.sessionId)?.abortController?.abort();
  }
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

new acp.AgentSideConnection(
  (connection) => new EchoAgent(connection),
  stream,
);
