import type { InboundMessage, OutboundMessage } from "../bus/events.js";
import type { MessageBus } from "../bus/queue.js";
import type { ProviderManager } from "../providers/provider_manager.js";
import type { LLMResponse } from "../providers/base.js";
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
import { SessionManager, type Session, type SessionEvent } from "../session/manager.js";
import type { CronService } from "../cron/service.js";
import type { Config } from "../config/schema.js";
import { evaluateSilentReply } from "./silent-reply-policy.js";
import { containsSilentReplyMarker } from "./tokens.js";
import { ExtensionToolAdapter } from "../extensions/tool-adapter.js";
import { createTypingStopControlMessage } from "../bus/control.js";
import type { ExtensionToolContext, ExtensionRegistry } from "../extensions/types.js";
import { InputBudgetPruner } from "./input-budget-pruner.js";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

type AssistantDeltaHandler = (delta: string) => void;
type SessionEventHandler = (event: SessionEvent) => void;

const TIME_HINT_TRIGGER_PATTERNS = [
  /\b(now|right now|current time|what time|today|tonight|tomorrow|yesterday|this morning|this afternoon|this evening|date)\b/i,
  /(现在|此刻|当前时间|现在几点|几点了|今天|今晚|今早|今晨|明天|昨天|日期)/
];

export class AgentLoop {
  private context: ContextBuilder;
  private sessions: SessionManager;
  private tools: ToolRegistry;
  private subagents: SubagentManager;
  private inputBudgetPruner = new InputBudgetPruner();
  private running = false;
  private currentExtensionToolContext: ExtensionToolContext = {};
  private readonly agentId: string;

  constructor(
    private options: {
      bus: MessageBus;
      providerManager: ProviderManager;
      workspace: string;
      model?: string | null;
      maxIterations?: number;
      contextTokens?: number;
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
      agentId?: string;
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
      contextTokens: options.contextTokens,
      braveApiKey: options.braveApiKey ?? undefined,
      execConfig: options.execConfig ?? { timeout: 60 },
      restrictToWorkspace: options.restrictToWorkspace ?? false
    });
    this.agentId = normalizeAgentId(options.agentId);

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

  private setSessionsSendToolContext(params: {
    sessionKey: string;
    channel: string;
    chatId: string;
    handoffDepth: number;
  }): void {
    const sessionsSendTool = this.tools.get("sessions_send");
    if (!(sessionsSendTool instanceof SessionsSendTool)) {
      return;
    }
    sessionsSendTool.setContext({
      currentSessionKey: params.sessionKey,
      currentAgentId: this.agentId,
      channel: params.channel,
      chatId: params.chatId,
      maxPingPongTurns: this.options.config?.session?.agentToAgent?.maxPingPongTurns ?? 0,
      currentHandoffDepth: params.handoffDepth
    });
  }

  private resolveHandoffDepth(metadata: Record<string, unknown>): number {
    const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
    if (!Number.isFinite(rawDepth) || rawDepth < 0) {
      return 0;
    }
    return Math.trunc(rawDepth);
  }

  async handleInbound(params: {
    message: InboundMessage;
    sessionKey?: string;
    publishResponse?: boolean;
    onAssistantDelta?: AssistantDeltaHandler;
  }): Promise<OutboundMessage | null> {
    const response = await this.processMessage(params.message, params.sessionKey, {
      onAssistantDelta: params.onAssistantDelta
    });
    const shouldPublish = params.publishResponse ?? true;
    if (response && shouldPublish) {
      await this.options.bus.publishOutbound(response);
    }
    if (!response && shouldPublish && params.message.channel !== "system") {
      await this.options.bus.publishOutbound(createTypingStopControlMessage(params.message));
    }
    return response;
  }

  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      const msg = await this.options.bus.consumeInbound();
      try {
        await this.handleInbound({ message: msg });
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
    this.options.providerManager.setConfig(config);
    this.options.model = config.agents.defaults.model;
    this.options.maxIterations = config.agents.defaults.maxToolIterations;
    this.options.contextTokens = config.agents.defaults.contextTokens;
    this.options.contextConfig = config.agents.context;
    this.options.braveApiKey = config.tools.web.search.apiKey || undefined;
    this.options.execConfig = config.tools.exec;
    this.options.restrictToWorkspace = config.tools.restrictToWorkspace;

    this.context.setContextConfig(config.agents.context);
    this.subagents.updateRuntimeOptions({
      model: config.agents.defaults.model,
      contextTokens: config.agents.defaults.contextTokens,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace
    });
    this.refreshRuntimeTools();
  }

  private refreshRuntimeTools(): void {
    this.tools = new ToolRegistry();
    this.registerDefaultTools();
    this.registerExtensionTools();
  }

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    abortSignal?: AbortSignal;
    onAssistantDelta?: AssistantDeltaHandler;
    onSessionEvent?: SessionEventHandler;
  }): Promise<string> {
    const msg: InboundMessage = {
      channel: params.channel ?? "cli",
      senderId: "user",
      chatId: params.chatId ?? "direct",
      content: params.content,
      timestamp: new Date(),
      attachments: [],
      metadata: params.metadata ?? {}
    };
    const response = await this.processMessage(msg, params.sessionKey, {
      abortSignal: params.abortSignal,
      onAssistantDelta: params.onAssistantDelta,
      onSessionEvent: params.onSessionEvent
    });
    return response?.content ?? "";
  }

  private resolveSessionModel(session: { metadata: Record<string, unknown> }, metadata: Record<string, unknown>): string {
    const clearModel = metadata.clear_model === true || metadata.reset_model === true;
    if (clearModel) {
      delete session.metadata.preferred_model;
    }

    const inboundModel = this.readMetadataModel(metadata);
    if (inboundModel) {
      session.metadata.preferred_model = inboundModel;
    }

    const sessionModel =
      typeof session.metadata.preferred_model === "string" ? session.metadata.preferred_model.trim() : "";
    if (sessionModel) {
      return sessionModel;
    }

    return this.options.model ?? this.options.providerManager.get().getDefaultModel();
  }

  private readMetadataModel(metadata: Record<string, unknown>): string | null {
    const candidates = [metadata.model, metadata.llm_model, metadata.agent_model, metadata.session_model];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return null;
  }

  private resolveRequestedSkillNames(metadata: Record<string, unknown>): string[] {
    const rawValue = metadata.requested_skills ?? metadata.requestedSkills;
    const values: string[] = [];
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (typeof item !== "string") {
          continue;
        }
        const trimmed = item.trim();
        if (trimmed) {
          values.push(trimmed);
        }
      }
    } else if (typeof rawValue === "string") {
      values.push(
        ...rawValue
          .split(/[,\s]+/g)
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }

    if (values.length === 0) {
      return [];
    }

    return Array.from(new Set(values)).slice(0, 8);
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private buildDeliveryContext(params: {
    channel: string;
    chatId: string;
    metadata: Record<string, unknown>;
    accountId?: string;
  }): Record<string, unknown> {
    const replyTo =
      this.normalizeOptionalString(params.metadata.reply_to) ??
      this.normalizeOptionalString(params.metadata.message_id);

    const deliveryMetadata: Record<string, unknown> = {};
    const slackMeta = params.metadata.slack;
    if (slackMeta && typeof slackMeta === "object" && !Array.isArray(slackMeta)) {
      const threadTs = this.normalizeOptionalString((slackMeta as Record<string, unknown>).thread_ts);
      const channelType = this.normalizeOptionalString((slackMeta as Record<string, unknown>).channel_type);
      if (threadTs || channelType) {
        deliveryMetadata.slack = {
          ...(threadTs ? { thread_ts: threadTs } : {}),
          ...(channelType ? { channel_type: channelType } : {})
        };
      }
    }

    const qqMeta = params.metadata.qq;
    if (qqMeta && typeof qqMeta === "object" && !Array.isArray(qqMeta)) {
      const msgId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).msgId);
      const msgSeq = this.normalizeOptionalString((qqMeta as Record<string, unknown>).msgSeq);
      const groupId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).groupId);
      const guildId = this.normalizeOptionalString((qqMeta as Record<string, unknown>).guildId);
      if (msgId || msgSeq || groupId || guildId) {
        deliveryMetadata.qq = {
          ...(msgId ? { msgId } : {}),
          ...(msgSeq ? { msgSeq } : {}),
          ...(groupId ? { groupId } : {}),
          ...(guildId ? { guildId } : {})
        };
      }
    }

    const groupId = this.normalizeOptionalString(params.metadata.group_id) ?? this.normalizeOptionalString(params.metadata.groupId);
    if (groupId) {
      deliveryMetadata.group_id = groupId;
    }

    const accountId =
      params.accountId ??
      this.normalizeOptionalString(params.metadata.accountId) ??
      this.normalizeOptionalString(params.metadata.account_id);
    if (accountId) {
      deliveryMetadata.accountId = accountId;
    }

    const context: Record<string, unknown> = {
      channel: params.channel,
      chatId: params.chatId,
      ...(replyTo ? { replyTo } : {}),
      ...(accountId ? { accountId } : {})
    };

    if (Object.keys(deliveryMetadata).length > 0) {
      context.metadata = deliveryMetadata;
    }

    return context;
  }

  private drainPendingSystemEvents(session: { metadata: Record<string, unknown> }): string[] {
    const key = "pending_system_events";
    const raw = session.metadata[key];
    if (!Array.isArray(raw)) {
      return [];
    }
    const events = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    delete session.metadata[key];
    return events;
  }

  private prependSystemEvents(content: string, events: string[]): string {
    if (!events.length) {
      return content;
    }
    const block = events.map((event) => `[System Message] ${event}`).join("\n");
    return `${block}\n\n${content}`;
  }

  private prependRequestedSkills(content: string, requestedSkillNames: string[]): string {
    if (!requestedSkillNames.length) {
      return content;
    }
    const names = requestedSkillNames.join(", ");
    return `[Requested skills for this turn: ${names}]\n\n${content}`;
  }

  private appendTimeHintForPrompt(content: string, timestamp: Date): string {
    if (!this.shouldAppendTimeHint(content)) {
      return content;
    }
    const date = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
    const timeHint = this.buildMinutePrecisionTimeHint(date);
    return `${content}\n\n[time_hint_local_minute] ${timeHint}`;
  }

  private shouldAppendTimeHint(content: string): boolean {
    const normalized = content.trim();
    if (!normalized) {
      return false;
    }
    return TIME_HINT_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private buildMinutePrecisionTimeHint(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const offsetHour = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const offsetMinute = String(absMinutes % 60).padStart(2, "0");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
    return `${year}-${month}-${day} ${hour}:${minute} ${sign}${offsetHour}:${offsetMinute} (${timezone})`;
  }

  private formatSystemMessageForPrompt(msg: InboundMessage): string {
    const sender = this.normalizeOptionalString(msg.senderId) ?? "system";
    const content = msg.content.trim();
    if (!content) {
      return `[System Message from ${sender}]`;
    }
    return `[System Message from ${sender}]\n${content}`;
  }

  private normalizeSystemEventType(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private recordSystemInboundEvent(params: {
    session: Session;
    message: InboundMessage;
    sessionKey: string;
    originChannel: string;
    originChatId: string;
    onSessionEvent?: SessionEventHandler;
  }): void {
    const kind =
      this.normalizeSystemEventType(params.message.metadata.system_event_kind) ??
      this.normalizeSystemEventType(params.message.senderId) ??
      "message";

    const event = this.sessions.appendEvent(params.session, {
      type: `system.${kind}`,
      timestamp: params.message.timestamp.toISOString(),
      data: {
        senderId: params.message.senderId,
        content: params.message.content,
        sourceChannel: params.message.channel,
        sourceChatId: params.message.chatId,
        originChannel: params.originChannel,
        originChatId: params.originChatId,
        sessionKey: params.sessionKey,
        metadata: { ...params.message.metadata }
      }
    });
    params.onSessionEvent?.(event);
  }

  private pruneMessagesForInputBudget(messages: Array<Record<string, unknown>>): void {
    const result = this.inputBudgetPruner.prune({
      messages,
      contextTokens: this.options.contextTokens
    });
    messages.splice(0, messages.length, ...result.messages);
  }

  private recordSessionMessage(params: {
    session: Session;
    role: string;
    content: unknown;
    extra?: Record<string, unknown>;
    onSessionEvent?: SessionEventHandler;
  }): void {
    const event = this.sessions.addMessage(params.session, params.role, params.content, params.extra ?? {});
    params.onSessionEvent?.(event);
  }

  private async processMessage(
    msg: InboundMessage,
    sessionKeyOverride?: string,
    options?: { abortSignal?: AbortSignal; onAssistantDelta?: AssistantDeltaHandler; onSessionEvent?: SessionEventHandler }
  ): Promise<OutboundMessage | null> {
    if (msg.channel === "system") {
      return this.processSystemMessage(msg, sessionKeyOverride, options);
    }

    const sessionKey = sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
    const session = this.sessions.getOrCreate(sessionKey);
    this.setExtensionToolContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });
    this.setSessionsSendToolContext({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      handoffDepth: this.resolveHandoffDepth(msg.metadata)
    });
    const runtimeModel = this.resolveSessionModel(session, msg.metadata);
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
    session.metadata.last_delivery_context = this.buildDeliveryContext({
      channel: msg.channel,
      chatId: msg.chatId,
      metadata: msg.metadata,
      accountId
    });

    const pendingSystemEvents = this.drainPendingSystemEvents(session);
    const requestedSkillNames = this.resolveRequestedSkillNames(msg.metadata);
    let currentMessage = this.prependRequestedSkills(
      this.prependSystemEvents(msg.content, pendingSystemEvents),
      requestedSkillNames
    );
    currentMessage = this.appendTimeHintForPrompt(currentMessage, msg.timestamp);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(msg.channel, msg.chatId);
    }
    const execTool = this.tools.get("exec");
    if (execTool instanceof ExecTool) {
      execTool.setContext({ sessionKey, channel: msg.channel, chatId: msg.chatId });
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(msg.channel, msg.chatId, runtimeModel, sessionKey, this.agentId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(msg.channel, msg.chatId);
    }
    const gatewayTool = this.tools.get("gateway");
    if (gatewayTool instanceof GatewayTool) {
      gatewayTool.setContext({ sessionKey });
    }

    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey,
      channel: msg.channel,
      chatId: msg.chatId,
      accountId: accountId ?? null
    });

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage,
      attachments: msg.attachments,
      channel: msg.channel,
      chatId: msg.chatId,
      sessionKey,
      skillNames: requestedSkillNames,
      messageToolHints
    });
    this.recordSessionMessage({
      session,
      role: "user",
      content: msg.content,
      onSessionEvent: options?.onSessionEvent
    });

    let iteration = 0;
    let finalContent: string | null = null;
    let lastToolName: string | null = null;
    let lastToolResult: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;
    try {
      while (iteration < maxIterations) {
        throwIfAborted(options?.abortSignal);
        iteration += 1;
        this.pruneMessagesForInputBudget(messages);
        const response = await this.chatWithOptionalStreaming({
          messages,
          tools: this.tools.getDefinitions(),
          model: runtimeModel,
          signal: options?.abortSignal
        }, options?.onAssistantDelta);
        throwIfAborted(options?.abortSignal);

        if (containsSilentReplyMarker(response.content)) {
          this.recordSessionMessage({
            session,
            role: "assistant",
            content: response.content ?? "",
            onSessionEvent: options?.onSessionEvent
          });
          this.sessions.save(session);
          return null;
        }

        if (response.toolCalls.length) {
          throwIfAborted(options?.abortSignal);
          const toolCallDicts = response.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }));
          this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
          this.recordSessionMessage({
            session,
            role: "assistant",
            content: response.content ?? "",
            extra: {
              tool_calls: toolCallDicts,
              reasoning_content: response.reasoningContent ?? null
            },
            onSessionEvent: options?.onSessionEvent
          });
          for (const call of response.toolCalls) {
            throwIfAborted(options?.abortSignal);
            const result = await this.tools.execute(call.name, call.arguments, call.id);
            throwIfAborted(options?.abortSignal);
            lastToolName = call.name;
            lastToolResult = result;
            this.context.addToolResult(messages, call.id, call.name, result);
            this.recordSessionMessage({
              session,
              role: "tool",
              content: result,
              extra: {
                tool_call_id: call.id,
                name: call.name
              },
              onSessionEvent: options?.onSessionEvent
            });
          }
        } else {
          finalContent = response.content;
          break;
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        this.sessions.save(session);
      }
      throw error;
    }

    throwIfAborted(options?.abortSignal);
    if (typeof finalContent !== "string") {
      finalContent = buildToolLoopFallback({
        maxIterations,
        lastToolName,
        lastToolResult
      });
    }

    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, messageId);
    finalContent = cleanedContent;
    const finalReplyDecision = evaluateSilentReply({
      content: finalContent,
      media: []
    });
    if (finalReplyDecision.shouldDrop) {
      this.sessions.save(session);
      return null;
    }
    finalContent = finalReplyDecision.content;

    this.recordSessionMessage({
      session,
      role: "assistant",
      content: finalContent,
      onSessionEvent: options?.onSessionEvent
    });
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

  private async processSystemMessage(
    msg: InboundMessage,
    sessionKeyOverride?: string,
    options?: { abortSignal?: AbortSignal; onAssistantDelta?: AssistantDeltaHandler; onSessionEvent?: SessionEventHandler }
  ): Promise<OutboundMessage | null> {
    const separator = msg.chatId.indexOf(":");
    const originChannel = separator > 0 ? msg.chatId.slice(0, separator) : "cli";
    const originChatId = separator > 0 ? msg.chatId.slice(separator + 1) : msg.chatId;

    const metadataSessionKey = this.normalizeOptionalString(msg.metadata.session_key_override);
    const sessionKey = sessionKeyOverride ?? metadataSessionKey ?? `${originChannel}:${originChatId}`;
    const session = this.sessions.getOrCreate(sessionKey);
    this.setExtensionToolContext({ sessionKey, channel: originChannel, chatId: originChatId });
    this.setSessionsSendToolContext({
      sessionKey,
      channel: originChannel,
      chatId: originChatId,
      handoffDepth: this.resolveHandoffDepth(msg.metadata)
    });
    const runtimeModel = this.resolveSessionModel(session, msg.metadata);

    const messageTool = this.tools.get("message");
    if (messageTool instanceof MessageTool) {
      messageTool.setContext(originChannel, originChatId);
    }
    const execTool = this.tools.get("exec");
    if (execTool instanceof ExecTool) {
      execTool.setContext({ sessionKey, channel: originChannel, chatId: originChatId });
    }
    const spawnTool = this.tools.get("spawn");
    if (spawnTool instanceof SpawnTool) {
      spawnTool.setContext(originChannel, originChatId, runtimeModel, sessionKey, this.agentId);
    }
    const cronTool = this.tools.get("cron");
    if (cronTool instanceof CronTool) {
      cronTool.setContext(originChannel, originChatId);
    }
    const gatewayTool = this.tools.get("gateway");
    if (gatewayTool instanceof GatewayTool) {
      gatewayTool.setContext({ sessionKey });
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
    const requestedSkillNames = this.resolveRequestedSkillNames(msg.metadata);
    const currentMessage = this.prependRequestedSkills(this.formatSystemMessageForPrompt(msg), requestedSkillNames);

    const messages = this.context.buildMessages({
      history: this.sessions.getHistory(session),
      currentMessage,
      channel: originChannel,
      chatId: originChatId,
      sessionKey,
      skillNames: requestedSkillNames,
      messageToolHints
    });
    this.recordSystemInboundEvent({
      session,
      message: msg,
      sessionKey,
      originChannel,
      originChatId,
      onSessionEvent: options?.onSessionEvent
    });

    let iteration = 0;
    let finalContent: string | null = null;
    let lastToolName: string | null = null;
    let lastToolResult: string | null = null;
    const maxIterations = this.options.maxIterations ?? 20;
    try {
      while (iteration < maxIterations) {
        throwIfAborted(options?.abortSignal);
        iteration += 1;
        this.pruneMessagesForInputBudget(messages);
        const response = await this.chatWithOptionalStreaming({
          messages,
          tools: this.tools.getDefinitions(),
          model: runtimeModel,
          signal: options?.abortSignal
        }, options?.onAssistantDelta);
        throwIfAborted(options?.abortSignal);

        if (containsSilentReplyMarker(response.content)) {
          this.recordSessionMessage({
            session,
            role: "assistant",
            content: response.content ?? "",
            onSessionEvent: options?.onSessionEvent
          });
          this.sessions.save(session);
          return null;
        }

        if (response.toolCalls.length) {
          throwIfAborted(options?.abortSignal);
          const toolCallDicts = response.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }));
          this.context.addAssistantMessage(messages, response.content, toolCallDicts, response.reasoningContent ?? null);
          this.recordSessionMessage({
            session,
            role: "assistant",
            content: response.content ?? "",
            extra: {
              tool_calls: toolCallDicts,
              reasoning_content: response.reasoningContent ?? null
            },
            onSessionEvent: options?.onSessionEvent
          });
          for (const call of response.toolCalls) {
            throwIfAborted(options?.abortSignal);
            const result = await this.tools.execute(call.name, call.arguments, call.id);
            throwIfAborted(options?.abortSignal);
            lastToolName = call.name;
            lastToolResult = result;
            this.context.addToolResult(messages, call.id, call.name, result);
            this.recordSessionMessage({
              session,
              role: "tool",
              content: result,
              extra: {
                tool_call_id: call.id,
                name: call.name
              },
              onSessionEvent: options?.onSessionEvent
            });
          }
        } else {
          finalContent = response.content;
          break;
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        this.sessions.save(session);
      }
      throw error;
    }

    throwIfAborted(options?.abortSignal);
    if (typeof finalContent !== "string") {
      finalContent = buildToolLoopFallback({
        maxIterations,
        lastToolName,
        lastToolResult
      });
    }
    const { content: cleanedContent, replyTo } = parseReplyTags(finalContent, undefined);
    finalContent = cleanedContent;
    const finalReplyDecision = evaluateSilentReply({
      content: finalContent,
      media: []
    });
    if (finalReplyDecision.shouldDrop) {
      this.sessions.save(session);
      return null;
    }
    finalContent = finalReplyDecision.content;

    this.recordSessionMessage({
      session,
      role: "assistant",
      content: finalContent,
      onSessionEvent: options?.onSessionEvent
    });
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

  private async chatWithOptionalStreaming(
    params: {
      messages: Array<Record<string, unknown>>;
      tools?: Array<Record<string, unknown>>;
      model?: string | null;
      maxTokens?: number;
      signal?: AbortSignal;
    },
    onAssistantDelta?: AssistantDeltaHandler
  ): Promise<LLMResponse> {
    if (!onAssistantDelta) {
      return await this.options.providerManager.chat(params);
    }

    let finalResponse: LLMResponse | null = null;
    for await (const event of this.options.providerManager.chatStream(params)) {
      if (event.type === "delta") {
        onAssistantDelta(event.delta);
        continue;
      }
      finalResponse = event.response;
    }

    if (!finalResponse) {
      throw new Error("provider stream ended without a final response");
    }

    return finalResponse;
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

function normalizeAgentId(value: string | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  return text || "main";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  const reason = signal.reason;
  if (reason instanceof Error) {
    if (reason.name === "AbortError") {
      throw reason;
    }
    const error = new Error(reason.message || "The operation was aborted.");
    error.name = "AbortError";
    throw error;
  }
  const message =
    typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : "The operation was aborted.";
  const error = new Error(message);
  error.name = "AbortError";
  throw error;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const message = error.message.toLowerCase();
    if (message.includes("aborted") || message.includes("abort")) {
      return true;
    }
  }
  return false;
}

function buildToolLoopFallback(params: {
  maxIterations: number;
  lastToolName: string | null;
  lastToolResult: string | null;
}): string {
  const { maxIterations, lastToolName, lastToolResult } = params;
  const base = `Sorry, tool calls did not converge after ${maxIterations} iterations. Please retry or rephrase.`;

  const toolLabel = lastToolName?.trim();
  const rawResult = lastToolResult?.trim() ?? "";
  if (!toolLabel && !rawResult) {
    return base;
  }

  const snippet = rawResult
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join(" ");
  const clipped = snippet.length > 180 ? `${snippet.slice(0, 180)}...` : snippet;
  const isError = clipped.startsWith("Error:");

  const detailParts: string[] = [];
  if (toolLabel) {
    detailParts.push(`Last tool: ${toolLabel}`);
  }
  if (clipped) {
    detailParts.push(`${isError ? "Last error" : "Last result"}: ${clipped}`);
  }

  return detailParts.length ? `${base} ${detailParts.join(". ")}` : base;
}
