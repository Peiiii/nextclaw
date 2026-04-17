#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

class HermesToolTitleAgent {
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

  newSession = async () => {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {});
    return { sessionId };
  };

  authenticate = async () => {
    return {};
  };

  setSessionMode = async () => {
    return {};
  };

  prompt = async (params) => {
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "hermes-title-call-1",
        title: "terminal: pwd",
        kind: "execute",
        status: "pending",
        rawInput: {
          command: "pwd",
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "hermes-title-call-1",
        status: "completed",
        rawOutput: {
          ok: true,
        },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "done",
        },
      },
    });
    return {
      stopReason: "end_turn",
    };
  };
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

new acp.AgentSideConnection(
  (connection) => new HermesToolTitleAgent(connection),
  stream,
);
