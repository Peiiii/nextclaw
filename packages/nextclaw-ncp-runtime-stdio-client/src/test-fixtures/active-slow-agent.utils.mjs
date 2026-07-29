import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ActiveSlowAgent {
  constructor(connection) {
    this.connection = connection;
    this.sessions = new Set();
  }

  initialize = async () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  });

  newSession = async () => {
    const sessionId = randomUUID();
    this.sessions.add(sessionId);
    return { sessionId };
  };

  authenticate = async () => ({});

  setSessionMode = async () => ({});

  prompt = async (params) => {
    if (!this.sessions.has(params.sessionId)) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    const sendUpdate = (update) => this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update,
    });
    await sendUpdate({
      sessionUpdate: "tool_call",
      toolCallId: "active-command",
      title: "active command",
      kind: "execute",
      status: "pending",
      rawInput: {},
    });
    let rawOutput = "";
    for (const text of ["active", " slow", " prompt", " done"]) {
      await sleep(30);
      rawOutput += text;
      await sendUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "active-command",
        status: "in_progress",
        rawOutput,
      });
    }
    await sendUpdate({
      sessionUpdate: "tool_call_update",
      toolCallId: "active-command",
      status: "completed",
      rawOutput,
    });
    await sendUpdate({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "active prompt completed" },
    });
    return { stopReason: "end_turn" };
  };

  cancel = async () => ({});
}

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin),
);
new acp.AgentSideConnection(
  (connection) => new ActiveSlowAgent(connection),
  stream,
);
