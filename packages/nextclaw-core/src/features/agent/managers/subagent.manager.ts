import { randomUUID } from "node:crypto";
import type { InboundMessage } from "@core/features/bus/index.js";
import type { MessageBus } from "@core/features/bus/index.js";
import type { SearchConfig } from "@core/features/config/index.js";
import type { ProviderManager } from "@core/features/llm-providers/index.js";
import { ToolRegistry } from "@core/features/agent/index.js";
import { ReadFileTool, WriteFileTool, ListDirTool } from "@core/features/agent/index.js";
import { ExecTool } from "@core/features/agent/index.js";
import { WebSearchTool, WebFetchTool } from "@core/features/agent/index.js";
import { InputBudgetPruner } from "@core/features/agent/index.js";
import { resolveSubagentModel } from "@core/features/agent/features/subagents/subagent-model.utils.js";

export class SubagentManager {
  private inputBudgetPruner = new InputBudgetPruner();
  private runningTasks = new Map<string, Promise<void>>();
  private runs = new Map<
    string,
    {
      id: string;
      label: string;
      task: string;
      origin: { channel: string; chatId: string; sessionKey?: string; agentId?: string; toolCallId?: string };
      startedAt: string;
      status: "running" | "done" | "error" | "cancelled";
      cancelled: boolean;
      doneAt?: string;
    }
  >();
  private steerQueue = new Map<string, string[]>();

  constructor(
    private options: {
      providerManager: ProviderManager;
      workspace: string;
      bus: MessageBus;
      model?: string;
      maxTokens?: number;
      contextTokens?: number;
      searchConfig?: SearchConfig;
      execConfig?: { timeout: number };
      restrictToWorkspace?: boolean;
      completionSink?: (params: {
        runId: string;
        label: string;
        task: string;
        result: string;
        origin: { channel: string; chatId: string; sessionKey?: string; agentId?: string; toolCallId?: string };
        status: "ok" | "error";
      }) => Promise<void>;
    }
  ) {}

  updateRuntimeOptions = (options: {
      model?: string;
      maxTokens?: number;
      contextTokens?: number;
      searchConfig?: SearchConfig;
      execConfig?: { timeout: number };
    restrictToWorkspace?: boolean;
  }): void => {
    const { model, maxTokens, contextTokens, searchConfig, execConfig, restrictToWorkspace } = options;
    if (Object.prototype.hasOwnProperty.call(options, "model")) {
      this.options.model = model;
    }
    if (Object.prototype.hasOwnProperty.call(options, "maxTokens")) {
      this.options.maxTokens = maxTokens;
    }
    if (Object.prototype.hasOwnProperty.call(options, "contextTokens")) {
      this.options.contextTokens = contextTokens;
    }
    if (Object.prototype.hasOwnProperty.call(options, "searchConfig")) {
      this.options.searchConfig = searchConfig;
    }
    if (Object.prototype.hasOwnProperty.call(options, "execConfig")) {
      this.options.execConfig = execConfig;
    }
    if (Object.prototype.hasOwnProperty.call(options, "restrictToWorkspace")) {
      this.options.restrictToWorkspace = restrictToWorkspace;
    }
  };

  spawn = async (params: {
    task: string;
    label?: string;
    model?: string;
    sessionModel?: string;
    originChannel?: string;
    originChatId?: string;
    originSessionKey?: string;
    originAgentId?: string;
    originToolCallId?: string;
  }): Promise<{ runId: string; label: string; task: string; status: "running"; message: string }> => {
    const {
      task,
      label,
      model: spawnModel,
      sessionModel,
      originChannel,
      originChatId,
      originSessionKey,
      originAgentId,
      originToolCallId
    } = params;
    const taskId = randomUUID().slice(0, 8);
    const displayLabel = label ?? `${task.slice(0, 30)}${task.length > 30 ? "..." : ""}`;
    const model = resolveSubagentModel({
      spawnModel,
      sessionModel,
      runtimeDefaultModel: this.options.model,
      providerDefaultModel: this.options.providerManager.get().getDefaultModel()
    });
    const origin = {
      channel: originChannel ?? "cli",
      chatId: originChatId ?? "direct",
      ...(originSessionKey?.trim() ? { sessionKey: originSessionKey.trim() } : {}),
      ...(originAgentId?.trim() ? { agentId: originAgentId.trim() } : {}),
      ...(originToolCallId?.trim() ? { toolCallId: originToolCallId.trim() } : {})
    };
    this.runs.set(taskId, {
      id: taskId,
      label: displayLabel,
      task,
      origin,
      startedAt: new Date().toISOString(),
      status: "running",
      cancelled: false
    });
    this.steerQueue.set(taskId, []);

    const background = this.runSubagent({
      taskId,
      task,
      label: displayLabel,
      model,
      origin
    });
    this.runningTasks.set(taskId, background);
    background.finally(() => {
      this.runningTasks.delete(taskId);
      const run = this.runs.get(taskId);
      if (run && run.status === "running") {
        run.status = run.cancelled ? "cancelled" : "done";
        run.doneAt = new Date().toISOString();
      }
      this.steerQueue.delete(taskId);
    });

    return {
      runId: taskId,
      label: displayLabel,
      task,
      status: "running",
      message: `Subagent [${displayLabel}] started (id: ${taskId}). I'll notify you when it completes.`,
    };
  };

  private runSubagent = async (params: {
    taskId: string;
    task: string;
    label: string;
    model: string;
    origin: { channel: string; chatId: string; sessionKey?: string; agentId?: string; toolCallId?: string };
  }): Promise<void> => {
    const { taskId, task, label, origin } = params;
    try {
      if (this.isRunCancelled(taskId)) {
        return;
      }
      const tools = this.createSubagentTools();
      const messages = this.createInitialMessages(task);
      const finalResult = await this.runSubagentLoop(params, tools, messages);
      if (finalResult === null) {
        return;
      }

      const runAfter = this.runs.get(taskId);
      if (runAfter && !runAfter.cancelled) {
        runAfter.status = "done";
        runAfter.doneAt = new Date().toISOString();
        await this.announceResult({
          runId: taskId,
          label,
          task,
          result: finalResult,
          origin,
          status: "ok"
        });
      }
    } catch (err) {
      const runAfter = this.runs.get(taskId);
      if (runAfter && !runAfter.cancelled) {
        runAfter.status = "error";
        runAfter.doneAt = new Date().toISOString();
        await this.announceResult({
          runId: taskId,
          label,
          task,
          result: `Error: ${String(err)}`,
          origin,
          status: "error"
        });
      }
    }
  };

  private createSubagentTools = (): ToolRegistry => {
    const tools = new ToolRegistry();
    const allowedDir = this.options.restrictToWorkspace ? this.options.workspace : undefined;
    tools.register(new ReadFileTool(allowedDir));
    tools.register(new WriteFileTool(allowedDir));
    tools.register(new ListDirTool(allowedDir));
    tools.register(
      new ExecTool({
        workingDir: this.options.workspace,
        timeout: this.options.execConfig?.timeout ?? 60,
        restrictToWorkspace: this.options.restrictToWorkspace ?? false
      })
    );
    tools.register(new WebSearchTool(this.options.searchConfig));
    tools.register(new WebFetchTool());
    return tools;
  };

  private createInitialMessages = (task: string): Array<Record<string, unknown>> => [
    { role: "system", content: this.buildSubagentPrompt(task) },
    { role: "user", content: task }
  ];

  private runSubagentLoop = async (
    params: {
      taskId: string;
      task: string;
      label: string;
      model: string;
      origin: { channel: string; chatId: string; sessionKey?: string; agentId?: string; toolCallId?: string };
    },
    tools: ToolRegistry,
    messages: Array<Record<string, unknown>>
  ): Promise<string | null> => {
    let iteration = 0;
    let finalResult: string | null = null;

    while (iteration < 15) {
      iteration += 1;
      this.flushSteerQueueIntoMessages(params.taskId, messages);
      const response = await this.requestSubagentTurn(messages, tools, params.model);
      if (!response.toolCalls.length) {
        finalResult = response.content ?? "";
        break;
      }
      await this.appendToolCallResults(messages, tools, response);
      if (this.isRunCancelled(params.taskId)) {
        return null;
      }
    }

    return finalResult ?? "Task completed but no final response was generated.";
  };

  private flushSteerQueueIntoMessages = (taskId: string, messages: Array<Record<string, unknown>>): void => {
    const queued = this.steerQueue.get(taskId);
    if (!queued?.length) {
      return;
    }
    for (const note of queued.splice(0, queued.length)) {
      messages.push({ role: "user", content: `Steer: ${note}` });
    }
  };

  private requestSubagentTurn = async (
    messages: Array<Record<string, unknown>>,
    tools: ToolRegistry,
    model: string
  ) => {
    const pruned = this.inputBudgetPruner.prune({
      messages,
      contextTokens: this.options.contextTokens
    });
    messages.splice(0, messages.length, ...pruned.messages);
    return this.options.providerManager.chat({
      messages,
      tools: tools.getDefinitions(),
      model,
      maxTokens: this.options.maxTokens
    });
  };

  private appendToolCallResults = async (
    messages: Array<Record<string, unknown>>,
    tools: ToolRegistry,
    response: Awaited<ReturnType<ProviderManager["chat"]>>
  ): Promise<void> => {
    const toolCalls = response.toolCalls.map((call) => ({
      id: call.id,
      type: "function",
      function: {
        name: call.name,
        arguments: JSON.stringify(call.arguments)
      }
    }));
    messages.push({ role: "assistant", content: response.content ?? "", tool_calls: toolCalls });
    for (const call of response.toolCalls) {
      const result = await tools.execute(call.name, call.arguments);
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result });
    }
  };

  private isRunCancelled = (taskId: string): boolean => this.runs.get(taskId)?.cancelled === true;

  private announceResult = async (params: {
    runId: string;
    label: string;
    task: string;
    result: string;
    origin: { channel: string; chatId: string; sessionKey?: string; agentId?: string; toolCallId?: string };
    status: "ok" | "error";
  }): Promise<void> => {
    const { label, task, result, origin, status } = params;
    if (origin.sessionKey?.trim() && this.options.completionSink) {
      await this.options.completionSink(params);
      return;
    }

    const statusText = status === "ok" ? "completed successfully" : "failed";
    const announceContent = `[Subagent '${label}' ${statusText}]\n\nTask: ${task}\n\nResult:\n${result}\n\nSummarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs.`;

    const msg: InboundMessage = {
      channel: "system",
      senderId: "subagent",
      chatId: `${origin.channel}:${origin.chatId}`,
      content: announceContent,
      timestamp: new Date(),
      attachments: [],
      metadata: {
        ...(origin.sessionKey ? { session_key_override: origin.sessionKey } : {}),
        ...(origin.agentId ? { target_agent_id: origin.agentId } : {}),
        system_event_kind: "subagent_completion",
        subagent_label: label,
        subagent_status: status
      }
    };

    await this.options.bus.publishInbound(msg);
  };

  private buildSubagentPrompt = (task: string): string => {
    return `# Subagent\n\nYou are a subagent spawned by the main agent to complete a specific task.\n\n## Your Task\n${task}\n\n## Rules\n1. Stay focused - complete only the assigned task, nothing else\n2. Your final response will be reported back to the main agent\n3. Do not initiate conversations or take on side tasks\n4. Be concise but informative in your findings\n\n## What You Can Do\n- Read and write files in the workspace\n- Execute shell commands\n- Search the web and fetch web pages\n- Complete the task thoroughly\n\n## What You Cannot Do\n- Send messages directly to users (no message tool available)\n- Spawn other subagents\n- Access the main agent's conversation history\n\n## Workspace\nYour workspace is at: ${this.options.workspace}\n\nWhen you have completed the task, provide a clear summary of your findings or actions.`;
  };

  getRunningCount = (): number => {
    return this.runningTasks.size;
  };

  listRuns = (): Array<{ id: string; label: string; status: string; startedAt: string; doneAt?: string }> => {
    return Array.from(this.runs.values()).map((run) => ({
      id: run.id,
      label: run.label,
      status: run.status,
      startedAt: run.startedAt,
      doneAt: run.doneAt
    }));
  };

  steerRun = (id: string, note: string): boolean => {
    const run = this.runs.get(id);
    if (!run || run.cancelled || run.status !== "running") {
      return false;
    }
    const queue = this.steerQueue.get(id);
    if (!queue) {
      return false;
    }
    queue.push(note);
    return true;
  };

  cancelRun = (id: string): boolean => {
    const run = this.runs.get(id);
    if (!run) {
      return false;
    }
    run.cancelled = true;
    run.status = "cancelled";
    run.doneAt = new Date().toISOString();
    this.steerQueue.delete(id);
    return true;
  };
}
