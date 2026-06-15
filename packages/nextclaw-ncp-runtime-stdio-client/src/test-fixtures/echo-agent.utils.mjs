#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

class EchoAgent {
  constructor(connection) {
    this.connection = connection;
    this.sessions = new Map();
  }

  initialize = async () => {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    };
  };

  newSession = async (params) => {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      modelId: null,
      abortController: null,
      cwd: params?.cwd ?? null,
    });
    return { sessionId };
  };

  authenticate = async () => {
    return {};
  };

  setSessionMode = async () => {
    return {};
  };

  unstable_setSessionModel = async (params) => {
    const session = this.sessions.get(params.sessionId);
    if (session) {
      session.modelId = params.modelId;
    }
    return {};
  };

  prompt = async (params) => {
    const { _meta, sessionId } = params;
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const abortController = new AbortController();
    session.abortController = abortController;

    const meta = _meta?.nextclaw_narp ?? {};
    const sessionMetadataPatch = readJsonObject(process.env.NEXTCLAW_ECHO_SESSION_METADATA_PATCH_JSON);
    if (sessionMetadataPatch) {
      await this.connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: "session_info_update",
          _meta: {
            nextclaw_narp: {
              sessionMetadataPatch,
            },
          },
        },
      });
    }
    await this.connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: {
          type: "text",
          text: "reasoning via ACP",
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId,
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
    const rawOutput = {
      modelId: session.modelId,
      routedModel: meta.providerRoute?.model ?? null,
      envRoutedModel: process.env.NEXTCLAW_MODEL ?? null,
      headerKeys: Object.keys(meta.providerRoute?.headers ?? {}),
      envHeaderKeys: (() => {
        const parsed = readJsonObject(process.env.NEXTCLAW_HEADERS_JSON);
        return parsed ? Object.keys(parsed) : [];
      })(),
      toolNames: Array.isArray(meta.tools)
        ? meta.tools.map((tool) => tool?.function?.name).filter(Boolean)
        : [],
    };
    if (process.env.NEXTCLAW_ECHO_CWD_INFO === "1") {
      rawOutput.sessionCwd = session.cwd;
      rawOutput.processCwd = process.cwd();
    }
    await this.connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "call-1",
        status: "completed",
        rawOutput,
      },
    });
    await this.connection.sessionUpdate({
      sessionId,
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
  };

  cancel = async (params) => {
    this.sessions.get(params.sessionId)?.abortController?.abort();
  };
}

function readJsonObject(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return typeof parsed === "object" && parsed && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

new acp.AgentSideConnection(
  (connection) => new EchoAgent(connection),
  stream,
);
