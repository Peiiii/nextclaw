import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { resolveToolProviderRunContext } from "@kernel/contributions/tool-provider/utils/tool-provider-run-context.utils.js";
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
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      kernel: this.kernel,
      request,
    });
    const { channel, chatId, metadata } = toolRunContext;
    const accountId = readMetadataAccountId(metadata);
    const messageTool = new MessageTool(
      async (message) => {
        const delivered = await this.kernel.channels.deliver(message);
        if (!delivered) {
          throw new Error(`channel "${message.channel}" is not available`);
        }
      },
      { resolveChannels: this.resolveMessageChannels },
    );
    messageTool.setContext(channel, chatId, accountId ?? null);
    const cronTool = new CronTool(this.kernel.automation);
    return [messageTool, cronTool];
  };

  private resolveMessageChannels = (): string[] => {
    const extensionRegistry = this.kernel.extensions.getExtensionRegistry();
    const channels = extensionRegistry?.channels ?? [];
    return [...new Set(channels.map((registration) => registration.channel.id.trim()).filter(Boolean))].sort();
  };
}
