#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class SlowCancelAgent {
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
    this.sessions.set(sessionId, {
      abortController: null,
    });
    return { sessionId };
  };

  authenticate = async () => {
    return {};
  };

  setSessionMode = async () => {
    return {};
  };

  prompt = async (params) => {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    const abortController = new AbortController();
    session.abortController = abortController;

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "partial",
        },
      },
    });

    while (!abortController.signal.aborted) {
      await sleep(10);
    }

    return {
      stopReason: "cancelled",
    };
  };

  cancel = async (params) => {
    await sleep(2_000);
    this.sessions.get(params.sessionId)?.abortController?.abort();
  };
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

new acp.AgentSideConnection(
  (connection) => new SlowCancelAgent(connection),
  stream,
);
