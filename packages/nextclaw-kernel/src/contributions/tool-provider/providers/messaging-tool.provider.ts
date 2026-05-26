import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";
import { normalizeString } from "@kernel/utils/ncp-message-bridge.utils.js";
import { CronTool, MessageTool } from "@nextclaw/core";

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
  readonly id = "nextclaw-messaging-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    context: ToolRunContext,
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
}
