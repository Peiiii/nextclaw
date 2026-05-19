import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import {
  CronTool,
  EditFileTool,
  ExecTool,
  ExtensionToolAdapter,
  GatewayTool,
  ListDirTool,
  MemoryGetTool,
  MemorySearchTool,
  MessageTool,
  ReadFileTool,
  SessionsHistoryTool,
  SessionsListTool,
  WebFetchTool,
  WebSearchTool,
  WriteFileTool,
} from "@nextclaw/core";
import type {
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";
import { SessionRequestTool } from "@kernel/tools/session-request.tools.js";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";
import { SessionSpawnTool } from "@kernel/tools/session-spawn.tools.js";
import { normalizeString } from "@kernel/utils/ncp-message-bridge.utils.js";

function readMetadataAccountId(metadata: Record<string, unknown>): string | undefined {
  const candidates = [metadata.accountId, metadata.account_id];
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

export class ToolContribution implements KernelContribution {
  private registration: { dispose: () => void } | null = null;

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.registration) {
      return;
    }
    this.registration = this.kernel.toolManager.provideTools({
      id: "nextclaw-core-tools",
      registerTools: this.registerTools,
    });
  };

  dispose = (): void => {
    this.registration?.dispose();
    this.registration = null;
  };

  private registerTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    this.registerDefaultTools(context, registry);
    this.registerExtensionTools(context, registry);
    this.registerSessionSearchTool(context, registry);
  };

  private registerDefaultTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    const {
      channel,
      chatId,
      execTimeoutSeconds,
      handoffDepth,
      metadata,
      restrictToWorkspace,
      searchConfig,
      sessionId,
      workspace,
    } = context;
    const allowedDir = restrictToWorkspace ? workspace : undefined;
    registry.registerTool(new ReadFileTool(allowedDir));
    registry.registerTool(new WriteFileTool(allowedDir));
    registry.registerTool(new EditFileTool(allowedDir));
    registry.registerTool(new ListDirTool(allowedDir));

    const execTool = new ExecTool({
      workingDir: workspace,
      timeout: execTimeoutSeconds,
      restrictToWorkspace,
    });
    execTool.setContext({
      sessionKey: sessionId,
      channel,
      chatId,
    });
    registry.registerTool(execTool);

    registry.registerTool(new WebSearchTool(searchConfig));
    registry.registerTool(new WebFetchTool());
    this.registerMessagingTools({ channel, chatId, metadata }, registry);

    const sessionsSpawnTool = new SessionSpawnTool(
      this.kernel.sessions,
      this.kernel.sessionRequests,
      this.kernel.publishSessionUpdated,
    );
    sessionsSpawnTool.setContext({
      sourceSessionId: sessionId,
      sourceSessionMetadata: metadata,
      handoffDepth,
    });
    registry.registerTool(sessionsSpawnTool);

    const sessionsRequestTool = new SessionRequestTool(this.kernel.sessionRequests);
    sessionsRequestTool.setContext({
      sourceSessionId: sessionId,
      handoffDepth,
    });
    registry.registerTool(sessionsRequestTool);

    registry.registerTool(new SessionsListTool(this.kernel.sessions));
    registry.registerTool(new SessionsHistoryTool(this.kernel.sessions));

    registry.registerTool(new MemorySearchTool(workspace));
    registry.registerTool(new MemoryGetTool(workspace));

    const gatewayTool = new GatewayTool(this.kernel.getGatewayController());
    gatewayTool.setContext({ sessionKey: sessionId });
    registry.registerTool(gatewayTool);
  };

  private registerMessagingTools = (
    context: Pick<ToolRunContext, "channel" | "chatId" | "metadata">,
    registry: ToolRegistrationContext,
  ): void => {
    const { channel, chatId, metadata } = context;
    const accountId = readMetadataAccountId(metadata);
    const messageTool = new MessageTool(
      (message) => this.kernel.messageBus.publishOutbound(message),
      { resolveChannels: this.resolveMessageChannels },
    );
    messageTool.setContext(channel, chatId, accountId ?? null);
    registry.registerTool(messageTool);

    const cronTool = new CronTool(this.kernel.automation);
    cronTool.setContext(channel, chatId, accountId ?? null);
    registry.registerTool(cronTool);
  };

  private resolveMessageChannels = (): string[] => {
    const extensionRegistry = this.kernel.extensions.getExtensionRegistry();
    const channels = extensionRegistry?.channels ?? [];
    return [...new Set(channels.map((registration) => registration.channel.id.trim()).filter(Boolean))].sort();
  };

  private registerExtensionTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    const extensionRegistry = this.kernel.extensions.getExtensionRegistry();
    if (!extensionRegistry || extensionRegistry.tools.length === 0) {
      return;
    }

    const seen = new Set<string>();
    for (const registration of extensionRegistry.tools) {
      for (const alias of registration.names) {
        if (seen.has(alias) || registry.hasTool(alias)) {
          continue;
        }
        seen.add(alias);
        registry.registerTool(
          new ExtensionToolAdapter({
            registration,
            alias,
            config: context.config,
            workspaceDir: context.workspace,
            contextProvider: registry.getExtensionToolRunContext,
            diagnostics: extensionRegistry.diagnostics,
          }),
        );
      }
    }
  };

  private registerSessionSearchTool = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    if (!this.kernel.sessionSearch.isReady()) {
      return;
    }
    registry.registerNcpTool(
      new SessionSearchTool(
        { search: this.kernel.sessionSearch.search },
        { currentSessionId: context.sessionId },
      ),
    );
  };
}
