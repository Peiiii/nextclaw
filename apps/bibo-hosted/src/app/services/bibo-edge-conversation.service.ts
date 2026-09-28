import { DefaultNcpAgentRuntime } from "@nextclaw/ncp-agent-runtime-next";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { NcpEventType, type NcpEndpointEvent, type NcpLLMApi, type NcpMessage, type NcpTool } from "@nextclaw/ncp";
import { AgentRunModelInputBuilder, AgentRunMessageProjector, AgentRunModelInputBudgeter } from "@nextclaw/kernel/model-input";
import { AgentRunContextCompactionManager } from "@nextclaw/kernel/context-compaction-runtime";
import { readLatestContextCompactionCheckpoint } from "@nextclaw/kernel/conversation-projection";
import { CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core/context-compaction";
import { createShowContentTools } from "@nextclaw/kernel/show-content";
import { createPortableRequestUserInputAsyncTool } from "@nextclaw/kernel/user-question-tool";
import { ToolSchemaTool } from "@nextclaw/kernel/tool-schema";
import { createQuestionMessage, createQuestionResolutionMessage, projectUserQuestions } from "@nextclaw/kernel/user-question";
import type { CompactionSummaryProvider } from "@nextclaw/kernel/context-compaction";
import { BiboSpaceService, type BiboSpaceState } from "@/features/bibo-domain";
import type { BiboQuestion, BiboShowContent } from "@nextclaw/bibo-client";
import { eventKeys, type UiShowContentEventPayload } from "@nextclaw/shared";
import { createBiboSpaceTool } from "@/features/bibo-domain/tools/bibo-space.tools";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboSpaceFileStore } from "../stores/bibo-space-file.store";
import { BiboEdgeSessionStore, type BiboEdgeSession } from "../stores/bibo-edge-session.store";
import { logDiagnostic, runFailure } from "../diagnostics/bibo-diagnostics.utils";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";

export type BiboEdgeRunResult = {
  text: string;
  ncpSession: BiboEdgeSession;
  previousSession: BiboEdgeSession | null;
  spaceState: BiboSpaceState | undefined;
  files: BiboSpaceFileStore;
  events: readonly NcpEndpointEvent[];
  displayEvents: BiboShowContent[];
  questions: BiboQuestion[];
};

const profile = { contextTokens: 200_000, reservedContextTokens: 10_000 };

function finalizeRun(manager: DefaultNcpAgentConversationStateManager,
  saved: BiboEdgeSession | null, events: readonly NcpEndpointEvent[], spaceState: BiboSpaceState | undefined,
  spaceChanged: boolean, files: BiboSpaceFileStore, displayEvents: BiboShowContent[]): BiboEdgeRunResult {
  const messages = manager.getSnapshot().messages;
  const assistant = [...messages].reverse().find((message) => message.role === "assistant" && message.status === "final");
  const text = assistant?.parts.filter((part) => part.type === "text").map((part) => part.text).join("") ?? "";
  if (!text) throw new Error("Bibo edge run has no complete answer");
  const metadata = { ...(saved?.metadata ?? {}) };
  for (const event of events) {
    if (event.type !== NcpEventType.RunMetadata || event.payload.metadata.kind !== "session_metadata_patch") continue;
    const patch = event.payload.metadata.sessionMetadataPatch;
    if (patch && typeof patch === "object" && !Array.isArray(patch)) Object.assign(metadata, patch);
  }
  const checkpoint = readLatestContextCompactionCheckpoint(messages);
  if (checkpoint) metadata[CONTEXT_COMPACTION_METADATA_KEY] = checkpoint;
  return { text, previousSession: saved, ncpSession: { version: 1, messages: [...messages], metadata },
    spaceState: spaceChanged ? spaceState : undefined, files, events, displayEvents,
    questions: projectUserQuestions(messages) as BiboQuestion[] };
}

function createInputMessage(sessionId: string, message: string, saved: BiboEdgeSession | null,
  question?: { id: string; action: "answer" | "dismiss"; answer: string }): NcpMessage {
  if (question) {
    const pending = projectUserQuestions(saved?.messages ?? []).find((item) => item.id === question.id);
    if (!pending || pending.status !== "pending") throw new Error("Bibo question is no longer pending");
    return createQuestionResolutionMessage(sessionId, pending, question.action, question.answer);
  }
  return { id: `user-message-${crypto.randomUUID()}`, sessionId, role: "user", status: "final",
    timestamp: new Date().toISOString(), parts: [{ type: "text", text: message }] };
}

function reportEdgeRunError(events: readonly NcpEndpointEvent[], tools: readonly NcpTool[], runId: string,
  sessionId: string, reason: string): void {
  const counts = new Map<string, number>();
  const knownTools = new Set(tools.map((tool) => tool.name));
  for (const event of events) {
    if (event.type !== NcpEventType.MessageToolCallStart) continue;
    const name = knownTools.has(event.payload.toolName) ? event.payload.toolName : "unknown";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const errorType = /Tool call limit reached/.test(reason) ? "ToolCallLimit" :
    /Assistant step completed without/.test(reason) ? "AssistantStepMissing" :
    /not available in this run/.test(reason) ? "ToolUnavailable" : "NcpRunError";
  logDiagnostic("worker", "edge.agent-error", { runId, sessionId, errorType,
    toolCount: [...counts.values()].reduce((total, count) => total + count, 0),
    toolSummary: [...counts].map(([name, count]) => `${name}:${count}`).join(",") }, "error");
}

/** Host adapter around the same NCP loop, model input and compaction used by the Node Kernel. */
export class BiboEdgeConversationService {
  constructor(
    private readonly storage: DurableObjectStorage,
    private readonly spaceStore: BiboSpaceStateStore,
    private readonly llmApi: NcpLLMApi,
    private readonly summaryProvider: CompactionSummaryProvider,
  ) {}

  run = async (input: {
    sessionId: string;
    message: string;
    contextBlocks?: readonly string[];
    buildContext?: (metadata: Record<string, unknown>) => Promise<readonly string[]>;
    runId: string;
    question?: { id: string; action: "answer" | "dismiss"; answer: string };
    tools?: readonly NcpTool[];
    signal?: AbortSignal;
    onDelta?: (delta: string) => void;
  }): Promise<BiboEdgeRunResult> => {
    const saved = await new BiboEdgeSessionStore(this.storage).load(input.sessionId);
    const contextBlocks = input.buildContext ? await input.buildContext(saved?.metadata ?? {}) : input.contextBlocks ?? [];
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.hydrate({ sessionId: input.sessionId, messages: saved?.messages ?? [] });
    const files = new BiboSpaceFileStore(this.storage);
    let spaceState = await this.spaceStore.load();
    let spaceChanged = false;
    const space = new BiboSpaceService("/data", {
      load: async () => spaceState,
      save: async (next) => { spaceState = structuredClone(next); spaceChanged = true; },
    }, files, { read: async () => await this.storage.get<string>("agentDeliveries") ?? null });
    const events: NcpEndpointEvent[] = [];
    const displayEvents: BiboShowContent[] = [];
    const showBus = { emit: (key: unknown, value: UiShowContentEventPayload) => {
      if (key !== eventKeys.uiShowContent || value.target.type !== "file" || displayEvents.some((item) => item.id === value.id)) return;
      displayEvents.push({ id: value.id, sessionId: input.sessionId,
        ...(value.title ? { title: value.title } : {}), target: value.target });
    } } as Parameters<typeof createShowContentTools>[0];
    const showFile = createShowContentTools(showBus, undefined, true).find((tool) => tool.name === "show_file");
    if (!showFile) throw new Error("Bibo show_file tool is unavailable");
    const sessionRun = {
      sessionId: input.sessionId,
      getSnapshot: () => {
        const snapshot = manager.getSnapshot();
        return { messages: snapshot.streamingMessage ? [...snapshot.messages, snapshot.streamingMessage] : snapshot.messages };
      },
      applyEvents: async (nextEvents: readonly NcpEndpointEvent[]) => {
        events.push(...nextEvents);
        await manager.dispatchBatch(nextEvents);
      },
    };
    const questionTool = createPortableRequestUserInputAsyncTool(async (prompts) => {
      const created = createQuestionMessage(input.sessionId, prompts);
      await sessionRun.applyEvents([{ type: NcpEventType.MessageSent, occurredAt: created.message.timestamp,
        payload: { sessionId: input.sessionId, message: created.message } }]);
      return { accepted: true, questionIds: created.questionIds };
    });
    const tools: NcpTool[] = [];
    tools.push(new ToolSchemaTool(() => tools, true), createBiboSpaceTool(space, input.sessionId, true), showFile, questionTool, ...(input.tools ?? []));
    const compaction = new AgentRunContextCompactionManager({ resolveAgentProfileForRun: () => profile }, this.summaryProvider);
    const runtime = new DefaultNcpAgentRuntime({
      llmApi: this.llmApi,
      modelInputBuilder: new AgentRunModelInputBuilder(new AgentRunMessageProjector(),
        new AgentRunModelInputBudgeter({ resolveAgentProfile: () => profile })),
      runPreflight: ({ contextBlocks, phase, sessionRun: current, spec, tools, signal }) => compaction.runPreflight({
        sessionId: current.sessionId, agentId: spec.agentId, contextBlocks, messages: current.getSnapshot().messages,
        metadata: saved?.metadata ?? {}, model: spec.model, phase, tools, signal,
      }),
    });
    const userMessage = createInputMessage(input.sessionId, input.message, saved, input.question);
    try {
      for await (const event of runtime.run({ agentId: "main", model: "deepseek-flash", requestedModel: null,
        runId: input.runId, runtimeId: "bibo-edge" }, {
        sessionRun, contextBlocks, initialMessages: [userMessage],
        tools, signal: input.signal,
      })) {
        if (event.type === NcpEventType.MessageTextDelta) input.onDelta?.(event.payload.delta);
      }
      const runError = events.find((event) => event.type === NcpEventType.RunError);
      if (runError) reportEdgeRunError(events, tools, input.runId, input.sessionId, runError.payload.error ?? "");
      if (input.signal?.aborted || runError) throw runFailure(runError?.payload.error, input.signal?.aborted);
      return finalizeRun(manager, saved, events, spaceState, spaceChanged, files, displayEvents);
    } catch (error) {
      files.rollback();
      throw error;
    }
  };

  commit = async (sessionId: string, result: BiboEdgeRunResult, metadata: Record<string, unknown>): Promise<void> => {
    const session = new BiboEdgeSessionStore(this.storage).prepareCommit(sessionId, result.previousSession, result.ncpSession);
    const entries = { ...metadata, ...session.entries };
    if (result.spaceState) await this.spaceStore.save(result.spaceState, entries, result.files, session.deletes);
    else await this.storage.transaction(async (transaction) =>
      applyBiboStorageChanges(transaction, entries, session.deletes));
    result.files.rollback();
  };
}
