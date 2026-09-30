import { NcpEventType, type NcpEndpointEvent, type NcpLLMApi, type NcpTool } from "@nextclaw/ncp";
import { NextclawHarness, Contribution } from "@nextclaw/harness";
import { CloudflarePlatform } from "./cloudflare-platform.service";
import { createShowContentTools, composeAgentToolCatalog, createWorkspaceByteTools,
  projectUserQuestions, type CompactionSummaryProvider } from "@nextclaw/kernel";
import type { BiboSpaceService } from "@/features/bibo-domain";
import type { BiboMessageContent, BiboQuestion, BiboShowContent } from "@nextclaw/bibo-client";
import { eventKeys, getKeyId, type UiShowContentEventPayload } from "@nextclaw/shared";
import { createBiboSpaceTool } from "@/features/bibo-domain/tools/bibo-space.tools";
import type { BiboWorkspaceFileService } from "./bibo-workspace-file.service";
import type { BiboEdgeSession } from "../stores/bibo-edge-session.store";
import { errorDetails, logDiagnostic, runFailure } from "../diagnostics/bibo-diagnostics.utils";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";
import { projectBiboRunContent } from "../utils/bibo-session.utils";
import { createBiboContextFiles } from "../utils/bibo-context-files.utils";

export type BiboEdgeRunResult = {
  text: string;
  content: BiboMessageContent[];
  ncpSession: BiboEdgeSession;
  previousSession: BiboEdgeSession | null;
  events: readonly NcpEndpointEvent[];
  displayEvents: BiboShowContent[];
  questions: BiboQuestion[];
};

function finalizeRun(next: BiboEdgeSession,
  saved: BiboEdgeSession | null, events: readonly NcpEndpointEvent[], displayEvents: BiboShowContent[],
  tools: readonly NcpTool[], runId: string, sessionId: string): BiboEdgeRunResult {
  const messages = next.messages;
  const { text, content } = projectBiboRunContent(saved?.messages ?? [], messages);
  if (!text && !content.some((part) => part.type === "questions")) throw new Error("Bibo edge run has no complete answer");
  logDiagnostic("worker", "edge.tool-summary", { runId, sessionId, ...summarizeToolCalls(events, tools),
    displayCount: displayEvents.length, showFileStatus: showFileStatus(events, displayEvents) });
  return { text, content, previousSession: saved, ncpSession: next,
    events, displayEvents,
    questions: projectUserQuestions(messages) as BiboQuestion[] };
}

function summarizeToolCalls(events: readonly NcpEndpointEvent[], tools: readonly NcpTool[]): {
  toolCount: number; toolSummary: string;
} {
  const counts = new Map<string, number>();
  const knownTools = new Set(tools.map((tool) => tool.name));
  for (const event of events) {
    if (event.type !== NcpEventType.MessageToolCallStart) continue;
    const name = knownTools.has(event.payload.toolName) ? event.payload.toolName : "unknown";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return { toolCount: [...counts.values()].reduce((total, count) => total + count, 0),
    toolSummary: [...counts].map(([name, count]) => `${name}:${count}`).join(",") };
}

function showFileStatus(events: readonly NcpEndpointEvent[], displayEvents: readonly BiboShowContent[]): string {
  const callIds = new Set<string>();
  for (const event of events) if (event.type === NcpEventType.MessageToolCallStart && event.payload.toolName === "show_file") {
    callIds.add(event.payload.toolCallId);
  }
  if (!callIds.size) return "not-called";
  if (displayEvents.length) return "emitted";
  const result = events.find((event) => event.type === NcpEventType.MessageToolCallResult && event.payload.final !== false
    && callIds.has(event.payload.toolCallId));
  if (result?.type === NcpEventType.MessageToolCallResult && result.payload.content && typeof result.payload.content === "object") {
    const content = result.payload.content as { ok?: unknown; error?: { code?: unknown } };
    if (content.ok === false && content.error?.code === "invalid_tool_arguments") return "invalid-tool-arguments";
    if (content.ok === false && content.error?.code === "tool_execution_failed") return "tool-execution-failed";
    if (content.ok === true) return "tool-success-no-event";
  }
  const chunks: string[] = [];
  for (const event of events) {
    if (event.type === NcpEventType.MessageToolCallArgs && callIds.has(event.payload.toolCallId)) { chunks.length = 0; chunks.push(event.payload.args); }
    if (event.type === NcpEventType.MessageToolCallArgsDelta && callIds.has(event.payload.toolCallId)) chunks.push(event.payload.delta);
  }
  if (!chunks.length) return "no-args";
  try {
    const parsed: unknown = JSON.parse(chunks.join(""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "non-object-args";
    const value = parsed as Record<string, unknown>;
    if (typeof value.path !== "string" || !value.path.trim()) return "missing-path";
    if (value.viewer !== undefined && !["auto", "source", "rendered"].includes(String(value.viewer))) return "invalid-viewer";
    if (Object.keys(value).some((key) => !["path", "title", "purpose", "line", "column", "viewer", "params"].includes(key))) return "unknown-arg";
    return "not-emitted";
  } catch { return "invalid-json"; }
}

function reportEdgeRunError(events: readonly NcpEndpointEvent[], tools: readonly NcpTool[], runId: string,
  sessionId: string, reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  const details = errorDetails(reason);
  const errorType = /Tool call limit reached/.test(message) ? "ToolCallLimit" :
    /Assistant step completed without/.test(message) ? "AssistantStepMissing" :
    /not available in this run/.test(message) ? "ToolUnavailable" : details.errorType ?? "NcpRunError";
  logDiagnostic("worker", "edge.agent-error", { runId, sessionId, errorType, errorLocation: details.errorLocation,
    ...summarizeToolCalls(events, tools) }, "error");
}

/** Bibo product tools and UI projections; execution belongs to the public Harness. */
export class BiboConversationService {
  private readonly platform: CloudflarePlatform;
  private readonly harness: NextclawHarness;
  private readonly scopes = new Map<string, { tools: readonly NcpTool[]; blocks: readonly string[] }>();

  constructor(
    private readonly storage: DurableObjectStorage,
    private readonly space: Pick<BiboSpaceService, "listActions" | "execute">,
    llmApi: NcpLLMApi,
    summaryProvider: CompactionSummaryProvider,
    private readonly workspaceFiles: Pick<BiboWorkspaceFileService, "workspace" | "executeSpace">,
    searchEnabled = false,
  ) {
    this.platform = new CloudflarePlatform(storage, llmApi, summaryProvider,
      createBiboContextFiles(workspaceFiles.workspace, searchEnabled));
    this.harness = new NextclawHarness({ platform: this.platform, allowSlashCommands: false });
    this.harness.contributions.register(new BiboConversationContribution(this.scopes));
  }

  dispose = async (): Promise<void> => { await this.harness.dispose(); };

  run = async (input: {
    sessionId: string;
    message: string;
    contextBlocks?: readonly string[];
    runId: string;
    question?: { id: string; action: "answer" | "dismiss"; answer: string };
    tools?: readonly NcpTool[];
    createTools?: () => readonly NcpTool[];
    signal?: AbortSignal;
    onDelta?: (delta: string, blockId?: string) => void;
  }): Promise<BiboEdgeRunResult> => {
    await this.harness.start();
    const record = await this.platform.sessions.getSession(input.sessionId);
    const saved: BiboEdgeSession | null = record ? { version: 1, messages: record.messages, metadata: record.metadata ?? {} } : null;
    const contextBlocks = input.contextBlocks ?? [];
    const events: NcpEndpointEvent[] = [];
    const displayEvents: BiboShowContent[] = [];
    const showBus = { emit: (key: unknown, value: UiShowContentEventPayload) => {
      const keyId = typeof key === "string" ? key : key && typeof key === "object" && "id" in key && typeof key.id === "string" ? key.id : "";
      if (keyId !== getKeyId(eventKeys.uiShowContent) ||
        value.target.type !== "file" || displayEvents.some((item) => item.id === value.id)) return;
      displayEvents.push({ id: value.id, sessionId: input.sessionId,
        ...(value.title ? { title: value.title } : {}), target: value.target });
    } } as Parameters<typeof createShowContentTools>[0];
    const showFile = createShowContentTools(showBus, undefined, true).find((tool) => tool.name === "show_file");
    if (!showFile) throw new Error("Bibo show_file tool is unavailable");
    const tools = composeAgentToolCatalog([
      [createBiboSpaceTool(this.space, input.sessionId, true), ...createWorkspaceByteTools(this.workspaceFiles.workspace),
        showFile],
      [...input.tools ?? [], ...input.createTools?.() ?? []],
    ], { includeSchemaTool: false, wrapTool: (tool) => ({
      name: tool.name, description: tool.description, parameters: tool.parameters,
      modelParameters: tool.modelParameters, supportsParallelToolCalls: tool.supportsParallelToolCalls,
      ...(tool.validateArgs ? { validateArgs: tool.validateArgs.bind(tool) } : {}),
      execute: async (args, context) => {
        const started = performance.now();
        try {
          const result = await tool.execute(args, context);
          logDiagnostic("worker", "edge.tool-completed", { runId: input.runId, sessionId: input.sessionId,
            toolName: tool.name, durationMs: Math.round(performance.now() - started), outcome: "success" });
          return result;
        } catch (error) {
          logDiagnostic("worker", "edge.tool-completed", { runId: input.runId, sessionId: input.sessionId,
            toolName: tool.name, durationMs: Math.round(performance.now() - started), outcome: "error",
            ...errorDetails(error) }, "error");
          throw error;
        }
      },
    }) });
    if (this.scopes.has(input.sessionId)) throw new Error("This session already has an active request scope.");
    this.scopes.set(input.sessionId, { tools, blocks: contextBlocks });
    let textBlock = 0;
    const callbacks = {
      signal: input.signal,
      onEvent: (event: NcpEndpointEvent) => {
        events.push(event);
        if (event.type === NcpEventType.MessageTextStart) textBlock += 1;
        if (event.type === NcpEventType.MessageTextDelta) input.onDelta?.(event.payload.delta, `${event.payload.messageId}:${textBlock}`);
      },
    };
    try {
      if (input.question) {
        await this.harness.answerUserQuestion({ sessionId: input.sessionId,
          questionId: input.question.id, action: input.question.action,
          answer: input.question.answer, ...callbacks });
      } else {
        await this.harness.runTask({ sessionId: input.sessionId, input: input.message, channel: "ui", ...callbacks });
      }
      const completed = await this.platform.sessions.getSession(input.sessionId);
      if (!completed) throw new Error("Completed session was not persisted");
      return finalizeRun({ version: 1, messages: completed.messages, metadata: completed.metadata ?? {} }, saved,
        events, displayEvents, tools,
        input.runId, input.sessionId);
    } catch (error) {
      reportEdgeRunError(events, tools, input.runId, input.sessionId, error);
      throw runFailure(error, input.signal?.aborted);
    } finally {
      this.scopes.delete(input.sessionId);
    }
  };

  commit = async (sessionId: string, metadata: Record<string, unknown>): Promise<void> => {
    let stage = "prepare-session";
    try {
      const session = await this.platform.sessions.prepareCheckpoint(sessionId);
      const entries = { ...metadata, ...session.entries };
      stage = "save-session";
      await this.storage.transaction(async (transaction) =>
        applyBiboStorageChanges(transaction, entries, session.deletes));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const errorCode = /storage limit|too large|exceeds/i.test(message) ? "STORAGE_SIZE" :
        /transaction/i.test(message) ? "STORAGE_TRANSACTION" :
        /duplicate message/i.test(message) ? "DUPLICATE_MESSAGE" : "EDGE_COMMIT_FAILED";
      logDiagnostic("worker", "edge.commit-failed", { runId: "edge-commit", sessionId, stage, errorCode, ...errorDetails(error) }, "error");
      throw error;
    }
  };
}

class BiboConversationContribution extends Contribution {
  constructor(private readonly scopes: ReadonlyMap<string, { tools: readonly NcpTool[]; blocks: readonly string[] }>) {
    super({ id: "bibo-product" });
  }
  protected setup = (): void => {
    this.effect(() => this.kernel.tools.registerProvider({
      provide: ({ sessionId }) => sessionId ? this.scopes.get(sessionId)?.tools ?? [] : [],
    }));
    this.effect(() => this.kernel.context.register({
      provide: ({ sessionId }) => sessionId ? this.scopes.get(sessionId)?.blocks ?? [] : [],
    }));
  };
}
