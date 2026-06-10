import { createAssetTools } from "@kernel/features/native-runtime/index.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { NcpTool } from "@nextclaw/ncp";

export class AssetToolProvider implements ToolProvider {
  constructor(private readonly assetStore: LocalAssetStore) {}

  provide = async (_request: AgentRunRequest): Promise<readonly NcpTool[]> =>
    createAssetTools({ assetStore: this.assetStore });
}
