import type { InboundMessage, OutboundMessage } from "../bus/events.js";
import type { MessageBus } from "../bus/queue.js";
import type { LLMProvider } from "../providers/base.js";
import { ContextBuilder } from "./context.js";
import { ToolRegistry } from "./tools/registry.js";
import { ReadFileTool, WriteFileTool, EditFileTool, ListDirTool } from "./tools/filesystem.js";
import { ExecTool } from "./tools/shell.js";
import { WebSearchTool, WebFetchTool } from "./tools/web.js";
import { MessageTool } from "./tools/message.js";
import { SpawnTool } from "./tools/spawn.js";
import { CronTool } from "./tools/cron.js";
import { SubagentManager } from "./subagent.js";
import { SessionManager } from "../session/manager.js";
import type { CronService } from "../cron/service.js";

export class AgentLoop {
  private context: ContextBuilder;
  private sessions: SessionManager;
  private tools: ToolRegistry;
  private subagents: SubagentManager;
  private running = false;

  constructor(
    private options: {
      bus: MessageBus;
      provider: LLMProvider;
      workspace: string;
      model?: string | null;
      maxIterations?: number;
      braveApiKey?: string | null;
      execConfig?: { timeout: number };
      cronService?: CronService | null;
      restrictToWorkspace?: boolean;
      sessionManager?: SessionManager;
    }
  ) {
    this.context = new ContextBuilder(options.workspace);
    this.sessions = options.sessionManager ?? new SessionManager(options.workspace);
    this.tools = new ToolRegistry();
    this.subagents = new SubagentManager({
      provider: options.provider,
      workspace: options.workspace,
      bus: options.bus,
      model: options.model ?? options.provider.getDefaultModel(),
      braveApiKey: options.braveApiKey ?? undefined,
      execConfig: options.execConfig ?? { timeout: 60 },
      restrictToWorkspace: options.restrictToWorkspace ?? false
    });

    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    const allowedDir = this.options.restrictToWorkspace ? this.options.workspace : undefined;
    this.tools.register(new ReadFileTool(allowedDir));
    this.tools.register(new WriteFileTool(allowedDir));
    this.tools.register(new EditFileTool(allowedDir));
    this.tools.register(new ListDirTool(allowedDir));

    this.tools.register(
      new ExecTool({
        workingDir: this.options.workspace,
        timeout: this.options.execConfig?.timeout ?? 60,
        restrictToWorkspace: this.options.restrictToWorkspace ?? false
      })
    );

    this.tools.register(new WebSearchTool(this.options.braveApiKey ?? undefined));
    this.tools.register(new WebFetchTool());

    const messageTool = new MessageTool((msg) => this.options.bus.publishOutbound(msg));
    this.tools.register(messageTool);

    const spawnTool = new SpawnTool(this.subagents);
    this.tools.register(spawnTool);

    if (this.options.cronService) {
      const cronTool = new CronTool(this.options.cronService);
      this.tools.register(cronTool);
    }
  }

  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      const msg = await this.options.bus.consumeInbound();
      try {
        const response = await this.processMessage(msg);
        if (response) {
          await this.options.bus.publishOutbound(response);
        }
      } catch (err) {
        await this.options.bus.publishOutbound({
          channel: msg.channel,
          chatId: msg.chatId,
          content: `Sorry, I encountered an error: ${String(err)}`,
          media: [],
          metadata: {}
        });
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
  }): Promise<string> {
    const msg: InboundMessage = {
      channel: params.channel ?? "cli",
      senderId: "user",
      chatId: params.chatId ?? "direct",
      content: params.content,
      timestamp: new Date(),
      media: [],
      metadata: {}
    };
    const response = await this.processMessage(msg, params.sessionKey);
    return response?.content ?? "";
  }

  private async processMessage(msg: InboundMessage, sessionKeyOverride?: string): Promise<OutboundMessage | null> {
    if (msg.channel === "system") {
      return this.processSystemMessage(msg);
    }

    const sessionKey = sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
    const session = this.sessions.getOrCreate(sessionKey);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(msg.channel, msg.chatId);
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(msg.channel, msg.chatId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(msg.channel, msg.chatId);
    }

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage: msg.content,
      media: msg.media,
      channel: msg.channel,
      chatId: msg.chatId
    });

    let iteration = 0;
    let finalContent: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;

    while (iteration < maxIterations) {
      iteration += 1;
      const response = await this.options.provider.chat({
        messages,
        tools: this.tools.getDefinitions(),
        model: this.options.model ?? undefined
      });

      if (response.toolCalls.length) {
        const toolCallDicts = response.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments)
          }
        }));
        this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
        for (const call of response.toolCalls) {
          const result = await this.tools.execute(call.name, call.arguments);
          this.context.addToolResult(messages, call.id, call.name, result);
        }
      } else {
        finalContent = response.content;
        break;
      }
    }

    if (!finalContent) {
      finalContent = "I've completed processing but have no response to give.";
    }

    this.sessions.addMessage(session, "user", msg.content);
    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: finalContent,
      media: [],
      metadata: msg.metadata ?? {}
    };
  }

  private async processSystemMessage(msg: InboundMessage): Promise<OutboundMessage | null> {
    const [originChannel, originChatId] = msg.chatId.includes(":")
      ? msg.chatId.split(":", 2)
      : ["cli", msg.chatId];

    const sessionKey = `${originChannel}:${originChatId}`;
    const session = this.sessions.getOrCreate(sessionKey);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(originChannel, originChatId);
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(originChannel, originChatId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(originChannel, originChatId);
    }

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage: msg.content,
      channel: originChannel,
      chatId: originChatId
    });

    let iteration = 0;
    let finalContent: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;

    while (iteration < maxIterations) {
      iteration += 1;
      const response = await this.options.provider.chat({
        messages,
        tools: this.tools.getDefinitions(),
        model: this.options.model ?? undefined
      });

      if (response.toolCalls.length) {
        const toolCallDicts = response.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments)
          }
        }));
        this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
        for (const call of response.toolCalls) {
          const result = await this.tools.execute(call.name, call.arguments);
          this.context.addToolResult(messages, call.id, call.name, result);
        }
      } else {
        finalContent = response.content;
        break;
      }
    }

    if (!finalContent) {
      finalContent = "Background task completed.";
    }

    this.sessions.addMessage(session, "user", `[System: ${msg.senderId}] ${msg.content}`);
    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    return {
      channel: originChannel,
      chatId: originChatId,
      content: finalContent,
      media: [],
      metadata: {}
    };
  }
}
