import { randomUUID } from "node:crypto";
import type { ProviderManager } from "../providers/provider_manager.js";
import type { MessageBus } from "../bus/queue.js";
import type { InboundMessage } from "../bus/events.js";
import { ToolRegistry } from "./tools/registry.js";
import { ReadFileTool, WriteFileTool, ListDirTool } from "./tools/filesystem.js";
import { ExecTool } from "./tools/shell.js";
import { WebSearchTool, WebFetchTool } from "./tools/web.js";

export class SubagentManager {
  private runningTasks = new Map<string, Promise<void>>();
  private runs = new Map<
    string,
    {
      id: string;
      label: string;
      task: string;
      origin: { channel: string; chatId: string };
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
      temperature?: number;
      braveApiKey?: string | null;
      execConfig?: { timeout: number };
      restrictToWorkspace?: boolean;
    }
  ) {}

  updateRuntimeOptions(options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    braveApiKey?: string | null;
    execConfig?: { timeout: number };
    restrictToWorkspace?: boolean;
  }): void {
    if (Object.prototype.hasOwnProperty.call(options, "model")) {
      this.options.model = options.model;
    }
    if (Object.prototype.hasOwnProperty.call(options, "maxTokens")) {
      this.options.maxTokens = options.maxTokens;
    }
    if (Object.prototype.hasOwnProperty.call(options, "temperature")) {
      this.options.temperature = options.temperature;
    }
    if (Object.prototype.hasOwnProperty.call(options, "braveApiKey")) {
      this.options.braveApiKey = options.braveApiKey;
    }
    if (Object.prototype.hasOwnProperty.call(options, "execConfig")) {
      this.options.execConfig = options.execConfig;
    }
    if (Object.prototype.hasOwnProperty.call(options, "restrictToWorkspace")) {
      this.options.restrictToWorkspace = options.restrictToWorkspace;
    }
  }

  async spawn(params: {
    task: string;
    label?: string;
    originChannel?: string;
    originChatId?: string;
  }): Promise<string> {
    const taskId = randomUUID().slice(0, 8);
    const displayLabel = params.label ?? `${params.task.slice(0, 30)}${params.task.length > 30 ? "..." : ""}`;
    const origin = {
      channel: params.originChannel ?? "cli",
      chatId: params.originChatId ?? "direct"
    };
    this.runs.set(taskId, {
      id: taskId,
      label: displayLabel,
      task: params.task,
      origin,
      startedAt: new Date().toISOString(),
      status: "running",
      cancelled: false
    });
    this.steerQueue.set(taskId, []);

    const background = this.runSubagent({
      taskId,
      task: params.task,
      label: displayLabel,
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

    return `Subagent [${displayLabel}] started (id: ${taskId}). I'll notify you when it completes.`;
  }

  private async runSubagent(params: {
    taskId: string;
    task: string;
    label: string;
    origin: { channel: string; chatId: string };
  }): Promise<void> {
    try {
      const run = this.runs.get(params.taskId);
      if (run?.cancelled) {
        return;
      }
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
      tools.register(new WebSearchTool(this.options.braveApiKey ?? undefined));
      tools.register(new WebFetchTool());

      const systemPrompt = this.buildSubagentPrompt(params.task);
      const messages: Array<Record<string, unknown>> = [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.task }
      ];

      let iteration = 0;
      let finalResult: string | null = null;

      while (iteration < 15) {
        iteration += 1;
        const queued = this.steerQueue.get(params.taskId);
        if (queued && queued.length) {
          for (const note of queued.splice(0, queued.length)) {
            messages.push({ role: "user", content: `Steer: ${note}` });
          }
        }
        const response = await this.options.providerManager.chat({
          messages,
          tools: tools.getDefinitions(),
          model: this.options.model,
          maxTokens: this.options.maxTokens,
          temperature: this.options.temperature
        });

        if (response.toolCalls.length) {
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
        } else {
          finalResult = response.content ?? "";
          break;
        }
        if (this.runs.get(params.taskId)?.cancelled) {
          return;
        }
      }

      if (!finalResult) {
        finalResult = "Task completed but no final response was generated.";
      }

      const runAfter = this.runs.get(params.taskId);
      if (runAfter && !runAfter.cancelled) {
        runAfter.status = "done";
        runAfter.doneAt = new Date().toISOString();
        await this.announceResult({
          label: params.label,
          task: params.task,
          result: finalResult,
          origin: params.origin,
          status: "ok"
        });
      }
    } catch (err) {
      const runAfter = this.runs.get(params.taskId);
      if (runAfter && !runAfter.cancelled) {
        runAfter.status = "error";
        runAfter.doneAt = new Date().toISOString();
        await this.announceResult({
          label: params.label,
          task: params.task,
          result: `Error: ${String(err)}`,
          origin: params.origin,
          status: "error"
        });
      }
    }
  }

  private async announceResult(params: {
    label: string;
    task: string;
    result: string;
    origin: { channel: string; chatId: string };
    status: "ok" | "error";
  }): Promise<void> {
    const statusText = params.status === "ok" ? "completed successfully" : "failed";
    const announceContent = `[Subagent '${params.label}' ${statusText}]\n\nTask: ${params.task}\n\nResult:\n${params.result}\n\nSummarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs.`;

    const msg: InboundMessage = {
      channel: "system",
      senderId: "subagent",
      chatId: `${params.origin.channel}:${params.origin.chatId}`,
      content: announceContent,
      timestamp: new Date(),
      media: [],
      metadata: {}
    };

    await this.options.bus.publishInbound(msg);
  }

  private buildSubagentPrompt(task: string): string {
    return `# Subagent\n\nYou are a subagent spawned by the main agent to complete a specific task.\n\n## Your Task\n${task}\n\n## Rules\n1. Stay focused - complete only the assigned task, nothing else\n2. Your final response will be reported back to the main agent\n3. Do not initiate conversations or take on side tasks\n4. Be concise but informative in your findings\n\n## What You Can Do\n- Read and write files in the workspace\n- Execute shell commands\n- Search the web and fetch web pages\n- Complete the task thoroughly\n\n## What You Cannot Do\n- Send messages directly to users (no message tool available)\n- Spawn other subagents\n- Access the main agent's conversation history\n\n## Workspace\nYour workspace is at: ${this.options.workspace}\n\nWhen you have completed the task, provide a clear summary of your findings or actions.`;
  }

  getRunningCount(): number {
    return this.runningTasks.size;
  }

  listRuns(): Array<{ id: string; label: string; status: string; startedAt: string; doneAt?: string }> {
    return Array.from(this.runs.values()).map((run) => ({
      id: run.id,
      label: run.label,
      status: run.status,
      startedAt: run.startedAt,
      doneAt: run.doneAt
    }));
  }

  steerRun(id: string, note: string): boolean {
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
  }

  cancelRun(id: string): boolean {
    const run = this.runs.get(id);
    if (!run) {
      return false;
    }
    run.cancelled = true;
    run.status = "cancelled";
    run.doneAt = new Date().toISOString();
    this.steerQueue.delete(id);
    return true;
  }
}
