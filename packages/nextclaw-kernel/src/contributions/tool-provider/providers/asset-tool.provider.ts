import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { createAssetTools } from "@kernel/features/native-runtime/index.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/features/agent-run/index.js";
import type { NcpTool } from "@nextclaw/ncp";

export class AssetToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (_request: AgentRunRequest): Promise<readonly NcpTool[]> =>
    createAssetTools({ assetStore: this.kernel.assetStore });
}
