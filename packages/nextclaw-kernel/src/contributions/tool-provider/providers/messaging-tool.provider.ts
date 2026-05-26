import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/features/agent-run/index.js";
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
  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      branch: this.branch,
      kernel: this.kernel,
      request,
    });
    const { channel, chatId, metadata } = toolRunContext;
    const accountId = readMetadataAccountId(metadata);
    const messageTool = new MessageTool(
      (message) => this.kernel.messageBus.publishOutbound(message),
      { resolveChannels: this.resolveMessageChannels },
    );
    messageTool.setContext(channel, chatId, accountId ?? null);
    const cronTool = new CronTool(this.kernel.automation);
    cronTool.setContext(channel, chatId, accountId ?? null);
    return [messageTool, cronTool];
  };

  private resolveMessageChannels = (): string[] => {
    const extensionRegistry = this.kernel.extensions.getExtensionRegistry();
    const channels = extensionRegistry?.channels ?? [];
    return [...new Set(channels.map((registration) => registration.channel.id.trim()).filter(Boolean))].sort();
  };
}
