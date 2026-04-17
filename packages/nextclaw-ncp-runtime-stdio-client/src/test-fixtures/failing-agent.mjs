#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

class FailingAgent {
  constructor() {
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
    this.sessions.set(sessionId, {});
    return { sessionId };
  }

  async authenticate() {
    return {};
  }

  async prompt() {
    throw new Error("fixture prompt failure");
  }
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

new acp.AgentSideConnection(
  () => new FailingAgent(),
  stream,
);
