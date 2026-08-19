import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";

type StressSessionConfig = {
  homeDir: string;
  sessionId: string;
  messageCount: number;
  toolCallsPerMessage: number;
  peakToolCalls: number;
  argumentBytesPerCall: number;
  resultBytesPerCall: number;
  textBytesPerMessage: number;
};

const FILLER = "0123456789abcdefghijklmnopqrstuvwxyz";

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function readPositiveInteger(name: string, fallback: number, maximum: number): number {
  const value = readOption(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return parsed;
}

function createConfig(): StressSessionConfig {
  const homeDir = readOption("--home-dir");
  if (!homeDir) {
    throw new Error("--home-dir is required so the stress fixture cannot write into an implicit user data directory.");
  }
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const messageCount = readPositiveInteger("--message-count", 180, 2_000);
  if (messageCount % 2 !== 0) {
    throw new Error("--message-count must be even so the final, visible message is the peak assistant trace.");
  }
  return {
    homeDir: resolve(homeDir),
    sessionId: readOption("--session-id") ?? `stress-tool-call-heavy-${timestamp}`,
    messageCount,
    toolCallsPerMessage: readPositiveInteger("--tool-calls-per-message", 50, 2_000),
    peakToolCalls: readPositiveInteger("--peak-tool-calls", 500, 5_000),
    argumentBytesPerCall: readPositiveInteger("--argument-bytes-per-call", 4_096, 262_144),
    resultBytesPerCall: readPositiveInteger("--result-bytes-per-call", 4_096, 262_144),
    textBytesPerMessage: readPositiveInteger("--text-bytes-per-message", 4_096, 262_144),
  };
}

function createText(bytes: number, prefix: string): string {
  return `${prefix}\n${FILLER.repeat(Math.ceil(bytes / FILLER.length)).slice(0, bytes)}`;
}

function createPayload(bytes: number, messageIndex: number, toolIndex: number, kind: "argument" | "result") {
  return {
    request: {
      id: `${kind}-${messageIndex}-${toolIndex}`,
      metadata: {
        messageIndex,
        toolIndex,
        kind,
        labels: ["stress", "chat", "nested-tool-payload"],
      },
      nested: {
        levelOne: {
          levelTwo: {
            levelThree: {
              payload: FILLER.repeat(Math.ceil(bytes / FILLER.length)).slice(0, bytes),
            },
          },
        },
      },
    },
  };
}

function createAssistantMessage(params: {
  config: StressSessionConfig;
  index: number;
  toolCallCount: number;
  timestamp: string;
}): NcpMessage {
  const { config, index, timestamp, toolCallCount } = params;
  const parts: NcpMessage["parts"] = [
    { type: "reasoning", text: createText(config.textBytesPerMessage, `Reasoning for stress turn ${index}.`) },
  ];
  for (let toolIndex = 0; toolIndex < toolCallCount; toolIndex += 1) {
    const toolName = ["exec_command", "write_file", "read_file", "web_fetch"][toolIndex % 4]!;
    parts.push({
      type: "tool-invocation",
      toolCallId: `stress-${index}-${toolIndex}`,
      toolName,
      state: "result",
      args: createPayload(config.argumentBytesPerCall, index, toolIndex, "argument"),
      result: createPayload(config.resultBytesPerCall, index, toolIndex, "result"),
      execution: { durationMs: 10 + (toolIndex % 250) },
    });
  }
  parts.push({ type: "text", text: createText(config.textBytesPerMessage, `Completed stress turn ${index}.`) });
  return {
    id: `assistant-stress-${index}`,
    sessionId: config.sessionId,
    role: "assistant",
    status: "final",
    timestamp,
    parts,
  };
}

function createMessages(config: StressSessionConfig): NcpMessage[] {
  const messages: NcpMessage[] = [];
  const startedAt = Date.now() - config.messageCount * 1_000;
  for (let index = 0; index < config.messageCount; index += 1) {
    const timestamp = new Date(startedAt + index * 1_000).toISOString();
    if (index % 2 === 0) {
      messages.push({
        id: `user-stress-${index}`,
        sessionId: config.sessionId,
        role: "user",
        status: "final",
        timestamp,
        parts: [{ type: "text", text: createText(config.textBytesPerMessage, `Stress request ${index}.`) }],
      });
      continue;
    }
    messages.push(createAssistantMessage({
      config,
      index,
      timestamp,
      toolCallCount: index === config.messageCount - 1
        ? config.peakToolCalls
        : config.toolCallsPerMessage,
    }));
  }
  return messages;
}

async function main() {
  const config = createConfig();
  await mkdir(resolve(config.homeDir, "sessions"), { recursive: true });
  const messages = createMessages(config);
  const journalDir = resolve(config.homeDir, "sessions", ".ncp-agent-journal");
  const store = new NcpAgentSessionJournalStore(journalDir);
  if (await store.hasSession(config.sessionId)) {
    throw new Error(`Session ${config.sessionId} already exists; choose a new --session-id instead of overwriting it.`);
  }
  const record: AgentSessionRecord = {
    sessionId: config.sessionId,
    agentId: "main",
    createdAt: messages[0]?.timestamp,
    updatedAt: messages.at(-1)?.timestamp ?? new Date().toISOString(),
    metadata: {
      label: "Tool-call stress fixture",
      stress_fixture: true,
      stress_fixture_config: config,
    },
    messages,
  };
  await store.importSessionSnapshot(record);

  const reloaded = new NcpAgentSessionJournalStore(journalDir);
  const page = await reloaded.listSessionMessagePage({
    sessionId: config.sessionId,
    limit: 100,
  });
  const journalSize = await stat(resolve(journalDir, `${config.sessionId}.jsonl`));
  if (!page || page.total !== config.messageCount) {
    throw new Error(`Fixture verification failed: expected ${config.messageCount} messages, got ${page?.total ?? 0}.`);
  }
  const peakMessage = page.messages.at(-1);
  const peakTools = peakMessage?.parts.filter((part) => part.type === "tool-invocation").length ?? 0;
  if (peakTools !== config.peakToolCalls) {
    throw new Error(`Fixture verification failed: expected ${config.peakToolCalls} peak tools, got ${peakTools}.`);
  }
  console.log(JSON.stringify({
    homeDir: config.homeDir,
    sessionId: config.sessionId,
    messages: page.total,
    peakTools,
    journalBytes: journalSize.size,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
