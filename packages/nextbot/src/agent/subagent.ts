import { randomUUID } from "node:crypto";
import type { LLMProvider } from "../providers/base.js";
import type { MessageBus } from "../bus/queue.js";
import type { InboundMessage } from "../bus/events.js";
import { ToolRegistry } from "./tools/registry.js";
import { ReadFileTool, WriteFileTool, ListDirTool } from "./tools/filesystem.js";
import { ExecTool } from "./tools/shell.js";
import { WebSearchTool, WebFetchTool } from "./tools/web.js";

export class SubagentManager {
  private runningTasks = new Map<string, Promise<void>>();

  constructor(
    private options: {
      provider: LLMProvider;
      workspace: string;
      bus: MessageBus;
      model?: string;
      braveApiKey?: string | null;
      execConfig?: { timeout: number };
      restrictToWorkspace?: boolean;
    }
  ) {}

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

    const background = this.runSubagent({
      taskId,
      task: params.task,
      label: displayLabel,
      origin
    });
    this.runningTasks.set(taskId, background);
    background.finally(() => this.runningTasks.delete(taskId));

    return `Subagent [${displayLabel}] started (id: ${taskId}). I'll notify you when it completes.`;
  }

  private async runSubagent(params: {
    taskId: string;
    task: string;
    label: string;
    origin: { channel: string; chatId: string };
  }): Promise<void> {
    try {
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
        const response = await this.options.provider.chat({
          messages,
          tools: tools.getDefinitions(),
          model: this.options.model
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
      }

      if (!finalResult) {
        finalResult = "Task completed but no final response was generated.";
      }

      await this.announceResult({
        label: params.label,
        task: params.task,
        result: finalResult,
        origin: params.origin,
        status: "ok"
      });
    } catch (err) {
      await this.announceResult({
        label: params.label,
        task: params.task,
        result: `Error: ${String(err)}`,
        origin: params.origin,
        status: "error"
      });
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
}
