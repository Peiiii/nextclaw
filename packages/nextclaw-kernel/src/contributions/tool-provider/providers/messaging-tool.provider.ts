import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { AutomationManager } from "@kernel/managers/automation.manager.js";
import type { ChannelManager } from "@kernel/managers/channel.manager.js";
import type { ExtensionManager } from "@kernel/managers/extension.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { normalizeString } from "@kernel/utils/ncp-message-bridge.utils.js";
import { CronTool, MessageTool } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

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

export class MessagingToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly channels: ChannelManager,
    private readonly automation: AutomationManager,
    private readonly extensions: ExtensionManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
    const { channel, chatId, metadata } = toolRunContext;
    const accountId = readMetadataAccountId(metadata);
    const messageTool = new MessageTool(
      async (message) => {
        const delivered = await this.channels.deliver(message);
        if (!delivered) {
          throw new Error(`channel "${message.channel}" is not available`);
        }
      },
      { resolveChannels: this.resolveMessageChannels },
    );
    messageTool.setContext(channel, chatId, accountId ?? null);
    const cronTool = new CronTool(this.automation);
    return [messageTool, cronTool];
  };

  private resolveMessageChannels = (): string[] => {
    const extensionRegistry = this.extensions.getExtensionRegistry();
    const channels = extensionRegistry?.channels ?? [];
    return [...new Set(channels.map((registration) => registration.channel.id.trim()).filter(Boolean))].sort();
  };
}
