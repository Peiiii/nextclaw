import type { InboundMessage, OutboundMessage } from "../bus/events.js";
import type { MessageBus } from "../bus/queue.js";
import type { ProviderManager } from "../providers/provider_manager.js";
import { ContextBuilder } from "./context.js";
import { ToolRegistry } from "./tools/registry.js";
import { ReadFileTool, WriteFileTool, EditFileTool, ListDirTool } from "./tools/filesystem.js";
import { ExecTool } from "./tools/shell.js";
import { WebSearchTool, WebFetchTool } from "./tools/web.js";
import { MessageTool } from "./tools/message.js";
import { SpawnTool } from "./tools/spawn.js";
import { CronTool } from "./tools/cron.js";
import { SessionsListTool, SessionsHistoryTool, SessionsSendTool } from "./tools/sessions.js";
import { MemorySearchTool, MemoryGetTool } from "./tools/memory.js";
import { GatewayTool, type GatewayController } from "./tools/gateway.js";
import { SubagentsTool } from "./tools/subagents.js";
import { SubagentManager } from "./subagent.js";
import { SessionManager } from "../session/manager.js";
import type { CronService } from "../cron/service.js";
import type { Config } from "../config/schema.js";
import { SILENT_REPLY_TOKEN, isSilentReplyText } from "./tokens.js";
import { ExtensionToolAdapter } from "../extensions/tool-adapter.js";
import type { ExtensionToolContext, ExtensionRegistry } from "../extensions/types.js";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

export class AgentLoop {
  private context: ContextBuilder;
  private sessions: SessionManager;
  private tools: ToolRegistry;
  private subagents: SubagentManager;
  private running = false;
  private currentExtensionToolContext: ExtensionToolContext = {};

  constructor(
    private options: {
      bus: MessageBus;
      providerManager: ProviderManager;
      workspace: string;
      model?: string | null;
      maxIterations?: number;
      braveApiKey?: string | null;
      execConfig?: { timeout: number };
      cronService?: CronService | null;
      restrictToWorkspace?: boolean;
      sessionManager?: SessionManager;
      contextConfig?: Config["agents"]["context"];
      gatewayController?: GatewayController;
      config?: Config;
      extensionRegistry?: ExtensionRegistry;
      resolveMessageToolHints?: MessageToolHintsResolver;
    }
  ) {
    this.context = new ContextBuilder(options.workspace, options.contextConfig);
    this.sessions = options.sessionManager ?? new SessionManager(options.workspace);
    this.tools = new ToolRegistry();
    this.subagents = new SubagentManager({
      providerManager: options.providerManager,
      workspace: options.workspace,
      bus: options.bus,
      model: options.model ?? options.providerManager.get().getDefaultModel(),
      braveApiKey: options.braveApiKey ?? undefined,
      execConfig: options.execConfig ?? { timeout: 60 },
      restrictToWorkspace: options.restrictToWorkspace ?? false
    });

    this.registerDefaultTools();
    this.registerExtensionTools();
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

    this.tools.register(new SessionsListTool(this.sessions));
    this.tools.register(new SessionsHistoryTool(this.sessions));
    this.tools.register(new SessionsSendTool(this.sessions, this.options.bus));

    this.tools.register(new MemorySearchTool(this.options.workspace));
    this.tools.register(new MemoryGetTool(this.options.workspace));

    this.tools.register(new SubagentsTool(this.subagents));
    this.tools.register(new GatewayTool(this.options.gatewayController));

    if (this.options.cronService) {
      const cronTool = new CronTool(this.options.cronService);
      this.tools.register(cronTool);
    }
  }


  private registerExtensionTools(): void {
    const registry = this.options.extensionRegistry;
    if (!registry || registry.tools.length === 0 || !this.options.config) {
      return;
    }

    const seen = new Set<string>(this.tools.toolNames);
    for (const registration of registry.tools) {
      for (const alias of registration.names) {
        if (seen.has(alias)) {
          continue;
        }
        seen.add(alias);
        this.tools.register(
          new ExtensionToolAdapter({
            registration,
            alias,
            config: this.options.config,
            workspaceDir: this.options.workspace,
            contextProvider: () => this.currentExtensionToolContext,
            diagnostics: registry.diagnostics
          })
        );
      }
    }
  }

  private setExtensionToolContext(params: { sessionKey: string; channel: string; chatId: string }): void {
    this.currentExtensionToolContext = {
      config: this.options.config,
      workspaceDir: this.options.workspace,
      sessionKey: params.sessionKey,
      channel: params.channel,
      chatId: params.chatId,
      sandboxed: this.options.restrictToWorkspace ?? false
    };
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

  applyRuntimeConfig(config: Config): void {
    this.options.config = config;
    this.options.model = config.agents.defaults.model;
    this.options.maxIterations = config.agents.defaults.maxToolIterations;
    this.options.contextConfig = config.agents.context;
    this.options.braveApiKey = config.tools.web.search.apiKey || undefined;
    this.options.execConfig = config.tools.exec;
    this.options.restrictToWorkspace = config.tools.restrictToWorkspace;

    this.context.setContextConfig(config.agents.context);
    this.subagents.updateRuntimeOptions({
      model: config.agents.defaults.model,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace
    });
  }

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const msg: InboundMessage = {
      channel: params.channel ?? "cli",
      senderId: "user",
      chatId: params.chatId ?? "direct",
      content: params.content,
      timestamp: new Date(),
      media: [],
      metadata: params.metadata ?? {}
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
    this.setExtensionToolContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });
    const messageId = msg.metadata?.message_id as string | undefined;
    if (messageId) {
      session.metadata.last_message_id = messageId;
    }
    const sessionLabel = msg.metadata?.session_label as string | undefined;
    if (sessionLabel) {
      session.metadata.label = sessionLabel;
    }
    session.metadata.last_channel = msg.channel;
    session.metadata.last_to = msg.chatId;
    const inboundAccountId =
      (msg.metadata?.account_id as string | undefined) ??
      (msg.metadata?.accountId as string | undefined);
    const accountId =
      inboundAccountId && inboundAccountId.trim().length > 0
        ? inboundAccountId
        : typeof session.metadata.last_account_id === "string" && session.metadata.last_account_id.trim().length > 0
          ? (session.metadata.last_account_id as string)
          : undefined;
    if (accountId) {
      session.metadata.last_account_id = accountId;
    }

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

    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      accountId: accountId ?? null
    });

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage: msg.content,
      media: msg.media,
      channel: msg.channel,
      chatId: msg.chatId,
      sessionKey,
      messageToolHints
    });
    this.sessions.addMessage(session, "user", msg.content);

    let iteration = 0;
    let finalContent: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;

    while (iteration < maxIterations) {
      iteration += 1;
      const response = await this.options.providerManager.get().chat({
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
        this.sessions.addMessage(session, "assistant", response.content ?? "", {
          tool_calls: toolCallDicts,
          reasoning_content: response.reasoningContent ?? null
        });
        for (const call of response.toolCalls) {
          const result = await this.tools.execute(call.name, call.arguments, call.id);
          this.context.addToolResult(messages, call.id, call.name, result);
          this.sessions.addMessage(session, "tool", result, {
            tool_call_id: call.id,
            name: call.name
          });
        }
      } else {
        finalContent = response.content;
        break;
      }
    }

    if (!finalContent) {
      finalContent = "I've completed processing but have no response to give.";
    }

    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, messageId);
    finalContent = cleanedContent;
    if (isSilentReplyText(finalContent, SILENT_REPLY_TOKEN)) {
      this.sessions.save(session);
      return null;
    }

    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: finalContent,
      replyTo,
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
    this.setExtensionToolContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });

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

    const accountId =
      (msg.metadata?.account_id as string | undefined) ??
      (msg.metadata?.accountId as string | undefined) ??
      (typeof session.metadata.last_account_id === "string" ? (session.metadata.last_account_id as string) : undefined);
    if (accountId) {
      session.metadata.last_account_id = accountId;
    }

    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey,
      channel: originChannel,
      chatId: originChatId,
      accountId: accountId ?? null
    });

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage: msg.content,
      channel: originChannel,
      chatId: originChatId,
      sessionKey,
      messageToolHints
    });
    this.sessions.addMessage(session, "user", `[System: ${msg.senderId}] ${msg.content}`);

    let iteration = 0;
    let finalContent: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;

    while (iteration < maxIterations) {
      iteration += 1;
      const response = await this.options.providerManager.get().chat({
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
        this.sessions.addMessage(session, "assistant", response.content ?? "", {
          tool_calls: toolCallDicts,
          reasoning_content: response.reasoningContent ?? null
        });
        for (const call of response.toolCalls) {
          const result = await this.tools.execute(call.name, call.arguments, call.id);
          this.context.addToolResult(messages, call.id, call.name, result);
          this.sessions.addMessage(session, "tool", result, {
            tool_call_id: call.id,
            name: call.name
          });
        }
      } else {
        finalContent = response.content;
        break;
      }
    }

    if (!finalContent) {
      finalContent = "Background task completed.";
    }
    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, undefined);
    finalContent = cleanedContent;
    if (isSilentReplyText(finalContent, SILENT_REPLY_TOKEN)) {
      this.sessions.save(session);
      return null;
    }

    this.sessions.addMessage(session, "assistant", finalContent);
    this.sessions.save(session);

    return {
      channel: originChannel,
      chatId: originChatId,
      content: finalContent,
      replyTo,
      media: [],
      metadata: msg.metadata ?? {}
    };
  }
}

function parseReplyTags(
  content: string,
  currentMessageId?: string
): { content: string; replyTo?: string } {
  let replyTo: string | undefined;
  const replyCurrent = /\[\[\s*reply_to_current\s*\]\]/gi;
  if (replyCurrent.test(content)) {
    replyTo = currentMessageId;
    content = content.replace(replyCurrent, "").trim();
  }
  const replyId = /\[\[\s*reply_to\s*:\s*([^\]]+?)\s*\]\]/i;
  const match = content.match(replyId);
  if (match && match[1]) {
    replyTo = match[1].trim();
    content = content.replace(replyId, "").trim();
  }
  return { content, replyTo };
}
